// @vitest-environment node
import { Inflate, strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { buildRawZip, buildZip } from '@/test/raw-zip';

import { readProjectZip, ZIP_LIMITS } from './read-project-zip';

const PLUGIN_MAIN = `<?php
/**
 * Plugin Name: Hello Pressbench
 */

defined( 'ABSPATH' ) || exit;
`;

const THEME_STYLE = `/*
Theme Name: Pressbench Blocks
*/
`;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

/** Builds a zip from a flat map of entry name → text or bytes. Names are used exactly as given. */
function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const flat: Zippable = {};
  for (const [name, content] of Object.entries(entries)) {
    flat[name] = typeof content === 'string' ? strToU8(content) : content;
  }
  return zipSync(flat);
}

async function refusal(data: Uint8Array, fileName = 'upload.zip'): Promise<string> {
  const result = await readProjectZip(data, fileName);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error.message;
}

describe('readProjectZip', () => {
  it('TC-PRJ-013a uses the single top-level folder as the project folder', async () => {
    const data = zip({
      'hello-pressbench/hello-pressbench.php': PLUGIN_MAIN,
      'hello-pressbench/assets/style.css': '.a { color: red; }',
    });

    const result = await readProjectZip(data, 'whatever-name.zip');

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'plugin',
        folder: 'hello-pressbench',
        mainFile: 'hello-pressbench/hello-pressbench.php',
        files: {
          'hello-pressbench/hello-pressbench.php': PLUGIN_MAIN,
          'hello-pressbench/assets/style.css': '.a { color: red; }',
        },
        skipped: [],
      },
    });
  });

  it('TC-PRJ-013b names the folder after the zip when files sit at the root', async () => {
    const data = zip({ 'hello.php': PLUGIN_MAIN, 'readme.txt': 'Hi' });

    const result = await readProjectZip(data, 'hello-dolly.1.7.2.zip');

    expect(result).toMatchObject({
      ok: true,
      value: {
        folder: 'hello-dolly.1.7.2',
        mainFile: 'hello-dolly.1.7.2/hello.php',
        files: { 'hello-dolly.1.7.2/hello.php': PLUGIN_MAIN, 'hello-dolly.1.7.2/readme.txt': 'Hi' },
      },
    });
  });

  it('TC-PRJ-013c refuses a zip with more than one top-level folder', async () => {
    const data = zip({ 'one/one.php': PLUGIN_MAIN, 'two/two.php': PLUGIN_MAIN });

    expect(await refusal(data)).toBe(
      'The zip has more than one top-level folder (one, two). A plugin or theme zip has exactly one.',
    );
  });

  it('TC-PRJ-006a detects a theme from style.css', async () => {
    const data = zip({
      'pressbench-blocks/style.css': THEME_STYLE,
      'pressbench-blocks/templates/index.html': '<!-- wp:paragraph -->',
    });

    const result = await readProjectZip(data, 'theme.zip');

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: 'theme',
        folder: 'pressbench-blocks',
        mainFile: 'pressbench-blocks/style.css',
      },
    });
  });

  it('TC-PRJ-007a refuses parent-folder paths', async () => {
    const data = zip({ 'plugin/plugin.php': PLUGIN_MAIN, 'plugin/../../evil.php': '<?php' });

    expect(await refusal(data)).toBe(
      'The zip contains an unsafe path, "plugin/../../evil.php": it goes outside the project folder.',
    );
  });

  it.each([
    ['/etc/passwd', 'it is an absolute path'],
    ['C:/Windows/x.php', 'it is an absolute path'],
    ['plugin\\evil.php', 'it uses backslashes'],
    ['plugin/nul.php', '"nul.php" is a reserved name on Windows.'],
    [
      'plugin/a\u0000.php',
      'Name contains invalid characters (< > : " | ? * or control characters).',
    ],
  ])('TC-PRJ-007b refuses the unsafe entry %j', async (name, reason) => {
    const data = zip({ 'plugin/plugin.php': PLUGIN_MAIN, [name]: '<?php' });

    const message = await refusal(data);

    expect(message).toContain('The zip contains an unsafe path');
    expect(message).toContain(name);
    expect(message).toContain(reason);
  });

  it('TC-PRJ-011a refuses a zip file over the size limit before reading it', async () => {
    const data = new Uint8Array(ZIP_LIMITS.maxZipBytes + 1);

    expect(await refusal(data)).toBe('The zip is larger than 20 MB.');
  });

  it('TC-PRJ-011b refuses more entries than the limit', async () => {
    const entries: Record<string, string> = { 'plugin/plugin.php': PLUGIN_MAIN };
    for (let index = 0; index < ZIP_LIMITS.maxEntries; index += 1) {
      entries[`plugin/f${String(index)}.txt`] = '';
    }

    expect(await refusal(zip(entries))).toBe('The zip has more than 2000 files.');
  });

  it('TC-PRJ-011c refuses a single file over the per-file limit', async () => {
    const data = zip({
      'plugin/plugin.php': PLUGIN_MAIN,
      'plugin/big.txt': new Uint8Array(ZIP_LIMITS.maxFileBytes + 1),
    });

    expect(await refusal(data)).toBe('"plugin/big.txt" is larger than 5 MB when unpacked.');
  });

  it('TC-PRJ-011d refuses an archive whose files add up to more than the total limit', async () => {
    const chunk = new Uint8Array(ZIP_LIMITS.maxFileBytes);
    const entries: Record<string, string | Uint8Array> = { 'plugin/plugin.php': PLUGIN_MAIN };
    for (let index = 0; index < 6; index += 1) {
      entries[`plugin/part-${String(index)}.txt`] = chunk;
    }

    expect(await refusal(zip(entries))).toBe('The zip unpacks to more than 25 MB.');
  });

  it('TC-PRJ-012 ignores macOS junk and skips binary files by path', async () => {
    const data = zip({
      'plugin/plugin.php': PLUGIN_MAIN,
      'plugin/assets/icon.png': PNG,
      'plugin/languages/plugin-fr.mo': new Uint8Array([0xde, 0x12, 0x04, 0x95, 0xff, 0xfe]),
      'plugin/notes.txt': new Uint8Array([0xff, 0xfe, 0x41]),
      'plugin/.DS_Store': new Uint8Array([0, 0, 0, 1]),
      '__MACOSX/plugin/._plugin.php': new Uint8Array([0, 5, 22, 7]),
    });

    const result = await readProjectZip(data, 'plugin.zip');

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'plugin',
        folder: 'plugin',
        mainFile: 'plugin/plugin.php',
        files: { 'plugin/plugin.php': PLUGIN_MAIN },
        skipped: ['plugin/assets/icon.png', 'plugin/languages/plugin-fr.mo', 'plugin/notes.txt'],
      },
    });
  });

  it('TC-PRJ-014a refuses a zip that is neither a plugin nor a theme', async () => {
    const data = zip({ 'notes/notes.php': '<?php echo 1;', 'notes/style.css': 'body {}' });

    expect(await refusal(data)).toBe(
      'This is not a WordPress plugin or theme: no PHP file in "notes" has a "Plugin Name:" header and there is no style.css with "Theme Name:".',
    );
  });

  it('TC-PRJ-014b refuses data that is not a zip file', async () => {
    expect(await refusal(strToU8('just some text'), 'notes.txt')).toBe(
      'This is not a valid zip file.',
    );
  });

  it('TC-PRJ-014c refuses an empty zip', async () => {
    expect(await refusal(zip({}))).toBe('The zip is empty.');
  });

  it('TC-PRJ-012a keeps a UTF-8 byte order mark, so the file is not changed silently', async () => {
    const withBom = `\uFEFF${PLUGIN_MAIN}`;

    const result = await readProjectZip(buildZip({ 'plugin/plugin.php': withBom }), 'plugin.zip');

    expect(result).toMatchObject({ ok: true, value: { files: { 'plugin/plugin.php': withBom } } });
  });

  it('TC-PRJ-014d finds a plugin header on the same line as the opening PHP tag', async () => {
    const data = buildZip({ 'one-line/one-line.php': '<?php /* Plugin Name: One Line */' });

    const result = await readProjectZip(data, 'one-line.zip');

    expect(result).toMatchObject({
      ok: true,
      value: { kind: 'plugin', mainFile: 'one-line/one-line.php' },
    });
  });
});

describe('readProjectZip with hostile archives', () => {
  const MAIN = new TextEncoder().encode(PLUGIN_MAIN);

  it('TC-PRJ-011e refuses records that point at the same data', async () => {
    const big = new Uint8Array(1024);
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 0, data: MAIN },
        { name: 'p/a.txt', method: 0, data: big },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: 'p/a.txt', local: 1 },
        { name: 'p/b.txt', local: 1 },
      ],
    );

    expect(await refusal(data)).toBe('The zip is damaged: two entries share the same data.');
  });

  it('TC-PRJ-011f refuses a stored file whose declared size does not match its data', async () => {
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 0, data: MAIN },
        { name: 'p/big.txt', method: 0, data: new Uint8Array(4096) },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: 'p/big.txt', local: 1, size: 0 },
      ],
    );

    expect(await refusal(data)).toBe(
      'The zip is damaged: "p/big.txt" does not match its declared size.',
    );
  });

  it('TC-PRJ-011g stops unpacking a deflated file as soon as it outgrows its declared size', async () => {
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 8, data: MAIN },
        { name: 'p/bomb.txt', method: 8, data: new Uint8Array(64 * 1024 * 1024) },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: 'p/bomb.txt', local: 1, size: 1024 },
      ],
    );
    const push = vi.spyOn(Inflate.prototype, 'push');

    const message = await refusal(data);

    expect(message).toBe('The zip is damaged: "p/bomb.txt" does not match its declared size.');
    // 64 MB of zeros deflates to about 64 KB, which is 64 steps of 1 KB; stopping early takes only a few.
    // One push is the small main file, unpacked first.
    const bombPushes = push.mock.calls.length - 1;
    expect(bombPushes).toBeLessThanOrEqual(3);
  });

  it('TC-PRJ-011h refuses encrypted entries and unsupported compression', async () => {
    const encrypted = buildRawZip(
      [{ name: 'p/p.php', method: 0, data: MAIN }],
      [{ name: 'p/p.php', local: 0, flags: 1 }],
    );
    const bzip2 = buildRawZip(
      [{ name: 'p/p.php', method: 0, data: MAIN }],
      [{ name: 'p/p.php', local: 0, method: 12 as 0 }],
    );

    expect(await refusal(encrypted)).toBe(
      '"p/p.php" is encrypted. Upload a zip without a password.',
    );
    expect(await refusal(bzip2)).toBe(
      '"p/p.php" uses a compression method that is not supported. Re-create the zip with standard settings.',
    );
  });

  it('TC-PRJ-007c refuses an entry with an empty name', async () => {
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 0, data: MAIN },
        { name: 'x', method: 0, data: MAIN },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: '', local: 1 },
      ],
    );

    expect(await refusal(data)).toBe('The zip contains an entry with an empty name.');
  });

  it('TC-PRJ-007d refuses names that are too long or too deep', async () => {
    const deep = `p/${'a/'.repeat(40)}x.txt`;
    const long = `p/${'n'.repeat(600)}.txt`;

    const deepMessage = await refusal(buildZip({ 'p/p.php': PLUGIN_MAIN, [deep]: 'x' }));
    const longMessage = await refusal(buildZip({ 'p/p.php': PLUGIN_MAIN, [long]: 'x' }));

    expect(deepMessage).toContain('it is nested more than 32 folders deep');
    expect(longMessage).toContain('it is longer than 512 characters');
    expect(longMessage.length).toBeLessThan(400);
  });

  it.each([
    ['p/evil‮txt.php', 'it contains invisible or direction-changing characters'],
    ['p​/p.php', 'it contains invisible or direction-changing characters'],
    ['p/a\u0085b.php', 'it contains control characters'],
  ])('TC-PRJ-007e refuses the spoofing name %j', async (name, reason) => {
    const message = await refusal(buildZip({ 'p/p.php': PLUGIN_MAIN, [name]: '<?php' }));

    expect(message).toContain('The zip contains an unsafe path');
    expect(message).toContain(reason);
  });

  it('TC-PRJ-007h refuses a name that starts with an invisible byte order mark', async () => {
    const message = await refusal(buildZip({ 'p/p.php': PLUGIN_MAIN, '\uFEFFp/x.php': '<?php' }));

    expect(message).toContain('it contains invisible or direction-changing characters');
  });

  it('TC-PRJ-007f refuses a non-ASCII name that is not marked as UTF-8', async () => {
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 0, data: MAIN },
        { name: 'x', method: 0, data: MAIN },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: new Uint8Array([0x70, 0x2f, 0x82, 0x2e, 0x70, 0x68, 0x70]), local: 1, utf8: false },
      ],
    );

    expect(await refusal(data)).toBe(
      'The zip has a file name in an unknown encoding. Re-create the zip with a tool that stores UTF-8 names.',
    );
  });

  it.each([
    ['exact duplicates', 'p/a.php', 'p/a.php'],
    ['names that differ only in case', 'p/A.php', 'p/a.php'],
    ['the same name in two Unicode forms', 'p/café.php', 'p/café.php'],
  ])('TC-PRJ-007g refuses %s', async (_label, first, second) => {
    const data = buildRawZip(
      [
        { name: 'p/p.php', method: 0, data: MAIN },
        { name: 'a', method: 0, data: MAIN },
        { name: 'b', method: 0, data: MAIN },
      ],
      [
        { name: 'p/p.php', local: 0 },
        { name: first, local: 1 },
        { name: second, local: 2 },
      ],
    );

    expect(await refusal(data)).toContain('appears more than once in the zip');
  });
});
