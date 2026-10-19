import { describe, expect, it } from 'vitest';

import { canFormat, formatParserFor, formatSource } from './format';

describe('formatSource', () => {
  it('TC-ED-014 formats JavaScript, TypeScript, CSS, SCSS and JSON in WordPress style', async () => {
    const js = await formatSource('a/b.js', 'const a = {x:1,y:[1,2]}; function f(a,b){return a+b}');
    const jsx = await formatSource('App.jsx', 'const A=()=><div className="x">{a}</div>');
    const ts = await formatSource('a.ts', 'export function f(a:number):number{return a}');
    const css = await formatSource('style.css', '.a{color:red;margin:0 auto}');
    const scss = await formatSource('style.scss', '.a{.b{color:red}}');
    const json = await formatSource('block.json', '{"a":1,"b":[1,2]}');

    expect(js).toEqual({
      ok: true,
      value: 'const a = { x: 1, y: [1, 2] };\nfunction f(a, b) {\n\treturn a + b;\n}\n',
    });
    expect(jsx).toEqual({
      ok: true,
      value: 'const A = () => <div className="x">{a}</div>;\n',
    });
    expect(ts).toEqual({
      ok: true,
      value: 'export function f(a: number): number {\n\treturn a;\n}\n',
    });
    expect(css).toEqual({ ok: true, value: '.a {\n\tcolor: red;\n\tmargin: 0 auto;\n}\n' });
    expect(scss).toEqual({ ok: true, value: '.a {\n\t.b {\n\t\tcolor: red;\n\t}\n}\n' });
    expect(json).toEqual({ ok: true, value: '{ "a": 1, "b": [1, 2] }\n' });
  });

  it('TC-ED-014a reports PHP and unknown files as unsupported without loading Prettier', async () => {
    expect(formatParserFor('plugin.php')).toBeNull();
    expect(formatParserFor('README')).toBeNull();
    expect(formatParserFor('x.JS')).toBe('babel');
    expect(canFormat('a.scss')).toBe(true);
    expect(canFormat('a.md')).toBe(false);

    const result = await formatSource('plugin.php', '<?php echo 1;');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unsupported',
        message:
          'Formatting is available for JavaScript, TypeScript, CSS, SCSS and JSON files only.',
      },
    });
  });

  it('TC-ED-014b reports a syntax error as a value with the position', async () => {
    const result = await formatSource('broken.js', 'function (');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'syntax',
        message: expect.stringMatching(
          /^The file could not be formatted because it has a syntax error: [^\n]+$/,
        ) as string,
      },
    });
  });
});
