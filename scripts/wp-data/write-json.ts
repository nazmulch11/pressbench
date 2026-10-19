/**
 * Serialises a data file with one entry per line, so a regeneration shows up in review as added, removed and
 * changed entries instead of one giant line (docs/UPDATING.md section 2).
 */
export function toDataFile(
  header: Record<string, unknown>,
  key: string,
  entries: readonly unknown[],
): string {
  const head = Object.entries(header)
    .map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    .join(',\n  ');
  const rows = entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return `{\n  ${head},\n  ${JSON.stringify(key)}: [\n${rows}\n  ]\n}\n`;
}
