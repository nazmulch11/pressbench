import { describe, expect, it } from 'vitest';

import { modelUri } from './model-uri';

/** The project path a URI stands for, decoded the way Monaco's `Uri.parse(…).path` decodes it. */
function decodedPath(uri: string): string {
  return decodeURIComponent(new URL(uri).pathname).replace(/^\//, '');
}

const NAMES = [
  'my-plugin/my-plugin.php',
  'my-plugin/notes 1.txt',
  'my-plugin/notes%201.txt',
  'my-plugin/notes#1.txt',
  'my-plugin/100%.txt',
  'my-plugin/ünïcödé/файл.php',
  "my-plugin/it's & more;=+,@$.css",
];

describe('modelUri', () => {
  it('TC-ED-027 gives every valid project path its own URI that decodes back to the path', () => {
    for (const path of NAMES) {
      const uri = new URL(modelUri(path));
      expect(uri.protocol).toBe('file:');
      expect(uri.hash).toBe('');
      expect(uri.search).toBe('');
      expect(decodedPath(modelUri(path))).toBe(path);
    }
    expect(new Set(NAMES.map(modelUri)).size).toBe(NAMES.length);
  });
});
