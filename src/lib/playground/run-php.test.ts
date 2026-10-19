import { describe, expect, it } from 'vitest';

import { runPhp, type PhpRunner } from './run-php';

const FATAL =
  'PHP Fatal error:  Uncaught Error: Call to undefined function nope() in /internal/eval.php:2\n' +
  'Stack trace:\n#0 {main}\n  thrown in /internal/eval.php on line 2\n';

function runnerReturning(output: string, errors = '', exitCode = 0): PhpRunner {
  return {
    run: () =>
      Promise.resolve({
        bytes: new TextEncoder().encode(output),
        errors,
        exitCode,
      }),
  };
}

describe('runPhp', () => {
  it('TC-PG-011a returns stdout, stderr and the exit code on success', async () => {
    const runner = runnerReturning('4');

    const result = await runPhp(runner, '<?php echo 2+2;');

    expect(result).toEqual({ ok: true, value: { output: '4', stderr: '', exitCode: 0 } });
  });

  it('TC-PG-011b maps a thrown Playground execution error to a php-error result', async () => {
    const thrown = Object.assign(new Error('PHP.run() failed with exit code 255.'), {
      response: {
        bytes: new TextEncoder().encode('<b>Fatal error</b>'),
        errors: FATAL,
        exitCode: 255,
      },
    });
    const runner: PhpRunner = { run: () => Promise.reject(thrown) };

    const result = await runPhp(runner, '<?php nope();');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'php-error',
        message: 'Uncaught Error: Call to undefined function nope() in /internal/eval.php:2',
        exitCode: 255,
        stderr: FATAL,
        output: '<b>Fatal error</b>',
      },
    });
  });

  it('TC-PG-011c maps a non-zero exit code with stderr to a php-error result', async () => {
    const runner = runnerReturning('', FATAL, 255);

    const result = await runPhp(runner, '<?php nope();');

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'php-error',
        exitCode: 255,
        stderr: FATAL,
        message: expect.stringContaining('Call to undefined function nope()') as string,
      },
    });
  });

  it('TC-PG-011e decodes response bytes that arrived as a plain object', async () => {
    const thrown = Object.assign(new Error('PHP.run() failed with exit code 1.'), {
      response: { bytes: { '0': 104, '1': 105 }, errors: '', exitCode: 1 },
    });
    const runner: PhpRunner = { run: () => Promise.reject(thrown) };

    const result = await runPhp(runner, '<?php exit(1);');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'php-error',
        message: 'PHP.run() failed with exit code 1.',
        exitCode: 1,
        stderr: '',
        output: 'hi',
      },
    });
  });

  it('TC-PG-011f treats an error whose response has no exit code as unknown', async () => {
    const thrown = Object.assign(new Error('bridge lost'), { response: 'gone' });
    const runner: PhpRunner = { run: () => Promise.reject(thrown) };

    const result = await runPhp(runner, '<?php echo 1;');

    expect(result).toEqual({ ok: false, error: { kind: 'unknown', message: 'bridge lost' } });
  });

  it('TC-PG-011d maps any other failure to an unknown error with its message', async () => {
    const runner: PhpRunner = { run: () => Promise.reject(new Error('worker crashed')) };

    const result = await runPhp(runner, '<?php echo 1;');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'worker crashed' },
    });
  });
});
