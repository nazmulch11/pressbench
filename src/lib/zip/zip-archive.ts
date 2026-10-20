/**
 * A minimal, defensive zip reader. It reads the central directory itself instead of trusting a library's
 * whole-archive unzip, so it can refuse archives that lie: entries sharing data, sizes that do not match the data,
 * encrypted or Zip64 entries. Files are inflated in small steps that stop as soon as the output passes the declared
 * size, so a hostile file costs at most its declared size plus one step, whatever its data says.
 */
import { Inflate } from 'fflate';

import { err, ok, type Result } from '@/lib/result';

/** One file or folder from the central directory. */
export interface ZipRecord {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly method: number;
  readonly compressedSize: number;
  /** The unpacked size the archive declares. Extraction refuses anything else. */
  readonly size: number;
  /** Where the compressed data starts. */
  readonly dataStart: number;
}

/** Why the archive itself was refused (as opposed to one of its names). */
export interface ZipFormatError {
  readonly kind: 'not-a-zip' | 'damaged' | 'unsupported';
  readonly message: string;
}

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_LENGTH = 22;
const MAX_COMMENT = 0xffff;
const UTF8_FLAG = 0x800;
const ENCRYPTED_FLAG = 0x1;
const ZIP64_MARKER = 0xffffffff;
// 1 KB of deflate data inflates to at most about 1 MB, which bounds the overshoot past the declared size.
const INFLATE_STEP = 1024;

const DAMAGED = 'The zip is damaged.';

function fail(
  message: string,
  kind: ZipFormatError['kind'] = 'damaged',
): Result<never, ZipFormatError> {
  return err({ kind, message });
}

function findEnd(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_LENGTH - MAX_COMMENT);
  for (let offset = view.byteLength - END_LENGTH; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function decodeName(bytes: Uint8Array, flags: number): string | null {
  if ((flags & UTF8_FLAG) !== 0) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }
  // Without the UTF-8 flag the encoding is unknown (often CP437); only plain ASCII can be read safely.
  return bytes.every((byte) => byte < 0x80) ? new TextDecoder('ascii').decode(bytes) : null;
}

interface RawRecord extends ZipRecord {
  readonly localOffset: number;
}

function readRecord(
  data: Uint8Array,
  view: DataView,
  offset: number,
  directoryStart: number,
): Result<{ record: RawRecord; next: number }, ZipFormatError> {
  if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
    return fail(DAMAGED);
  }
  const flags = view.getUint16(offset + 8, true);
  const method = view.getUint16(offset + 10, true);
  const compressedSize = view.getUint32(offset + 20, true);
  const size = view.getUint32(offset + 24, true);
  const nameLength = view.getUint16(offset + 28, true);
  const next =
    offset +
    46 +
    nameLength +
    view.getUint16(offset + 30, true) +
    view.getUint16(offset + 32, true);
  const localOffset = view.getUint32(offset + 42, true);
  if (next > view.byteLength) {
    return fail(DAMAGED);
  }
  const name = decodeName(data.subarray(offset + 46, offset + 46 + nameLength), flags);
  if (name === null) {
    return fail(
      'The zip has a file name in an unknown encoding. Re-create the zip with a tool that stores UTF-8 names.',
      'unsupported',
    );
  }
  if (compressedSize === ZIP64_MARKER || size === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
    return fail(
      'The zip uses the Zip64 format, which is not supported. Plugin zips never need it.',
      'unsupported',
    );
  }
  if ((flags & ENCRYPTED_FLAG) !== 0) {
    return fail(`"${name}" is encrypted. Upload a zip without a password.`, 'unsupported');
  }
  if (localOffset + 30 > directoryStart || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
    return fail(DAMAGED);
  }
  const dataStart =
    localOffset +
    30 +
    view.getUint16(localOffset + 26, true) +
    view.getUint16(localOffset + 28, true);
  if (dataStart + compressedSize > directoryStart) {
    return fail(DAMAGED);
  }
  return ok({
    record: {
      name,
      isDirectory: name.endsWith('/'),
      method,
      compressedSize,
      size,
      dataStart,
      localOffset,
    },
    next,
  });
}

/** Two records may not use the same bytes: overlapping entries are how zip bombs multiply a small file. */
function hasOverlap(records: readonly RawRecord[]): boolean {
  const ranges = records
    .map((record) => [record.localOffset, record.dataStart + record.compressedSize] as const)
    .sort((a, b) => a[0] - b[0]);
  return ranges.some((range, index) => index > 0 && range[0] < (ranges[index - 1]?.[1] ?? 0));
}

/** Lists every record of the central directory. Nothing is unpacked. */
export function listZip(data: Uint8Array): Result<ZipRecord[], ZipFormatError> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = data.length >= END_LENGTH ? findEnd(view) : -1;
  if (end === -1) {
    return fail('This is not a valid zip file.', 'not-a-zip');
  }
  const count = view.getUint16(end + 10, true);
  const directoryLength = view.getUint32(end + 12, true);
  const directoryStart = view.getUint32(end + 16, true);
  if (directoryStart === ZIP64_MARKER || count === 0xffff) {
    return fail(
      'The zip uses the Zip64 format, which is not supported. Plugin zips never need it.',
      'unsupported',
    );
  }
  if (directoryStart + directoryLength > end) {
    return fail(DAMAGED);
  }
  const records: RawRecord[] = [];
  let offset = directoryStart;
  for (let index = 0; index < count; index += 1) {
    const read = readRecord(data, view, offset, directoryStart);
    if (!read.ok) {
      return read;
    }
    records.push(read.value.record);
    offset = read.value.next;
  }
  if (hasOverlap(records)) {
    return fail('The zip is damaged: two entries share the same data.');
  }
  return ok(records);
}

/**
 * Unpacks one record. The result is exactly `record.size` bytes, or an error: output past the declared size stops
 * the inflater at once.
 */
export function extractRecord(
  data: Uint8Array,
  record: ZipRecord,
): Result<Uint8Array, ZipFormatError> {
  const mismatch = fail(`The zip is damaged: "${record.name}" does not match its declared size.`);
  const compressed = data.subarray(record.dataStart, record.dataStart + record.compressedSize);
  if (record.method === 0) {
    return compressed.length === record.size ? ok(compressed.slice()) : mismatch;
  }
  if (record.method !== 8) {
    return fail(
      `"${record.name}" uses a compression method that is not supported. Re-create the zip with standard settings.`,
      'unsupported',
    );
  }
  const out = new Uint8Array(record.size);
  // Held in an object: the inflater's callback changes it, which plain locals would hide from the type checker.
  const progress = { written: 0, isOver: false };
  const inflater = new Inflate((chunk) => {
    if (progress.isOver || progress.written + chunk.length > record.size) {
      progress.isOver = true;
      return;
    }
    out.set(chunk, progress.written);
    progress.written += chunk.length;
  });
  try {
    if (compressed.length === 0) {
      inflater.push(compressed, true);
    }
    for (let offset = 0; offset < compressed.length && !progress.isOver; offset += INFLATE_STEP) {
      const stop = Math.min(offset + INFLATE_STEP, compressed.length);
      inflater.push(compressed.subarray(offset, stop), stop === compressed.length);
    }
  } catch {
    return fail(`The zip is damaged: "${record.name}" could not be unpacked.`);
  }
  return progress.isOver || progress.written !== record.size ? mismatch : ok(out);
}
