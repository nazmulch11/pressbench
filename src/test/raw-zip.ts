/**
 * Builds zip files byte by byte, with full control over the central directory, so tests can produce archives that
 * lie about sizes, share data between entries or use odd names, the way a hostile upload would.
 */
import { deflateSync } from 'fflate';

export interface RawLocal {
  /** The real bytes of the file (deflated when `method` is 8). */
  readonly data: Uint8Array;
  readonly method: 0 | 8;
  readonly name?: string;
}

export interface RawCentral {
  readonly name: string | Uint8Array;
  /** Index into the `locals` list: which stored data this record points at. */
  readonly local: number;
  readonly method?: 0 | 8;
  /** Defaults to the real compressed size. */
  readonly compressedSize?: number;
  /** Defaults to the real size. */
  readonly size?: number;
  /** Defaults to true: the UTF-8 name flag (general purpose bit 11). */
  readonly utf8?: boolean;
  /** Extra general purpose flag bits, for example 1 for "encrypted". */
  readonly flags?: number;
}

const encoder = new TextEncoder();

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Builds a zip whose local entries and central-directory records are given separately. */
export function buildRawZip(
  locals: readonly RawLocal[],
  centrals: readonly RawCentral[],
): Uint8Array {
  const parts: Uint8Array[] = [];
  const stored: { offset: number; compressed: Uint8Array; size: number; method: 0 | 8 }[] = [];
  let offset = 0;
  for (const local of locals) {
    const compressed = local.method === 8 ? deflateSync(local.data) : local.data;
    const name = encoder.encode(local.name ?? 'x');
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, local.method, true);
    view.setUint32(18, compressed.length, true);
    view.setUint32(22, local.data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    stored.push({ offset, compressed, size: local.data.length, method: local.method });
    parts.push(header, compressed);
    offset += header.length + compressed.length;
  }
  const directoryStart = offset;
  let directoryLength = 0;
  for (const central of centrals) {
    const target = stored[central.local];
    if (target === undefined) {
      throw new Error(`no local entry ${String(central.local)}`);
    }
    const name = typeof central.name === 'string' ? encoder.encode(central.name) : central.name;
    const record = new Uint8Array(46 + name.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, (central.utf8 === false ? 0 : 0x800) | (central.flags ?? 0), true);
    view.setUint16(10, central.method ?? target.method, true);
    view.setUint32(20, central.compressedSize ?? target.compressed.length, true);
    view.setUint32(24, central.size ?? target.size, true);
    view.setUint16(28, name.length, true);
    view.setUint32(42, target.offset, true);
    record.set(name, 46);
    parts.push(record);
    directoryLength += record.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, centrals.length, true);
  view.setUint16(10, centrals.length, true);
  view.setUint32(12, directoryLength, true);
  view.setUint32(16, directoryStart, true);
  parts.push(end);
  return concat(parts);
}

/** A plain zip: each entry stored (or deflated) once, with honest sizes and UTF-8 names. */
export function buildZip(
  entries: Readonly<Record<string, string | Uint8Array>>,
  method: 0 | 8 = 8,
): Uint8Array {
  const names = Object.keys(entries);
  return buildRawZip(
    names.map((name) => {
      const content = entries[name] ?? '';
      return {
        name,
        method,
        data: typeof content === 'string' ? encoder.encode(content) : content,
      };
    }),
    names.map((name, local) => ({ name, local })),
  );
}
