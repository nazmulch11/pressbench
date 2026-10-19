// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { toDataFile } from './write-json';

describe('toDataFile', () => {
  it('TC-ED-017b writes the header first and one entry per line', () => {
    const text = toDataFile({ source: { name: 'x', version: '1' } }, 'items', [
      { name: 'a' },
      { name: 'b' },
    ]);

    expect(text).toBe(
      '{\n  "source": {"name":"x","version":"1"},\n  "items": [\n    {"name":"a"},\n    {"name":"b"}\n  ]\n}\n',
    );
    expect(JSON.parse(text)).toEqual({
      source: { name: 'x', version: '1' },
      items: [{ name: 'a' }, { name: 'b' }],
    });
  });
});
