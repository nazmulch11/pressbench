import { describe, expect, it } from 'vitest';

import { languageForPath } from './languages';

describe('languageForPath', () => {
  it('TC-ED-002 maps the supported extensions to Monaco language ids', () => {
    const cases: readonly [string, string][] = [
      ['my-plugin/my-plugin.php', 'php'],
      ['assets/app.js', 'javascript'],
      ['assets/app.jsx', 'javascript'],
      ['assets/app.ts', 'typescript'],
      ['assets/app.tsx', 'typescript'],
      ['assets/style.css', 'css'],
      ['assets/style.scss', 'scss'],
      ['templates/index.html', 'html'],
      ['block.json', 'json'],
      ['README.md', 'markdown'],
      ['readme.txt', 'plaintext'],
      ['STYLE.CSS', 'css'],
      ['.htaccess', 'plaintext'],
      ['LICENSE', 'plaintext'],
      ['archive.tar.gz', 'plaintext'],
    ];

    const actual = Object.fromEntries(cases.map(([path]) => [path, languageForPath(path)]));

    expect(actual).toEqual(Object.fromEntries(cases));
  });
});
