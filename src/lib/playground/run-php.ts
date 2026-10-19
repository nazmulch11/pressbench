import { err, ok } from '@/lib/result';

import type { PhpRunResult, PlaygroundError } from './types';

/** The parts of a Playground PHP response this module reads. */
export interface PhpResponseLike {
  readonly bytes: Uint8Array;
  readonly errors: string;
  readonly exitCode: number;
}

/** The one method of a Playground client (browser or Node) needed to run code. */
export interface PhpRunner {
  run(request: { readonly code: string }): Promise<PhpResponseLike>;
}

const decoder = new TextDecoder();

/** Decodes response bytes, which arrive as a `Uint8Array` or as a plain object with numeric keys after structured cloning. */
export function decodeBytes(bytes: unknown): string {
  if (bytes instanceof Uint8Array) {
    return decoder.decode(bytes);
  }
  if (typeof bytes === 'object' && bytes !== null) {
    return decoder.decode(Uint8Array.from(Object.values(bytes as Record<string, number>)));
  }
  return '';
}

/** The first `PHP Fatal error`, `PHP Warning` or similar line of stderr, without its label. */
function firstErrorLine(stderr: string): string | undefined {
  const line = stderr.split('\n').find((candidate) => candidate.trim().length > 0);
  if (line === undefined) {
    return undefined;
  }
  return line.replace(/^PHP (?:Fatal error|Parse error|Warning|Notice|Deprecated):\s*/, '').trim();
}

function toResponseLike(value: unknown): PhpResponseLike | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as Partial<Record<keyof PhpResponseLike, unknown>>;
  if (typeof candidate.exitCode !== 'number') {
    return undefined;
  }
  return {
    bytes: candidate.bytes instanceof Uint8Array ? candidate.bytes : new Uint8Array(),
    errors: typeof candidate.errors === 'string' ? candidate.errors : '',
    exitCode: candidate.exitCode,
  };
}

function phpError(
  response: PhpResponseLike,
  fallbackMessage: string,
  output: string,
): PlaygroundError {
  return {
    kind: 'php-error',
    message: firstErrorLine(response.errors) ?? fallbackMessage,
    exitCode: response.exitCode,
    stderr: response.errors,
    output,
  };
}

/**
 * Runs PHP code and turns every outcome into a value. Playground rejects with an execution error when the script
 * exits with a non-zero code; that error carries the response, which is mapped to `kind: 'php-error'`.
 */
export async function runPhp(runner: PhpRunner, code: string): Promise<PhpRunResult> {
  let response: PhpResponseLike;
  try {
    response = await runner.run({ code });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const attached =
      typeof error === 'object' && error !== null && 'response' in error
        ? toResponseLike(error.response)
        : undefined;
    if (attached === undefined) {
      return err({ kind: 'unknown', message });
    }
    const rawBytes = (error as { response: { bytes?: unknown } }).response.bytes;
    return err(phpError(attached, message.split('\n')[0] ?? message, decodeBytes(rawBytes)));
  }

  const output = decodeBytes(response.bytes);
  if (response.exitCode !== 0) {
    return err(phpError(response, `PHP exited with code ${String(response.exitCode)}`, output));
  }
  return ok({ output, stderr: response.errors, exitCode: response.exitCode });
}
