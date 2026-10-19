/**
 * Small PHPDoc reader shared by the stubs parser and the hooks converter. It understands only what the
 * editor needs: the summary paragraph, tags with their continuation lines, and a few helpers that reduce
 * long descriptions to one sentence.
 */

export interface DocTag {
  readonly name: string;
  /** Everything after the tag name, continuation lines joined with a space. */
  readonly content: string;
}

export interface DocBlock {
  /** The first paragraph, lines joined with a space. */
  readonly summary: string;
  readonly tags: readonly DocTag[];
}

const TAG_LINE = /^@([\w-]+)\s*(.*)$/;
const VERSION = /^(\d[\w.-]*|MU \([^)]*\))/;

/** Parses the text between the opening `/**` and the closing marker of a docblock. */
export function parseDocBlock(raw: string): DocBlock {
  const lines = raw.split('\n').map((line) => line.replace(/^\s*\*? ?/, '').trimEnd());
  const summary: string[] = [];
  const tags: DocTag[] = [];
  let current: { name: string; parts: string[] } | null = null;
  let inSummary = true;

  for (const line of lines) {
    const tag = TAG_LINE.exec(line);
    if (tag !== null) {
      inSummary = false;
      if (current !== null) {
        tags.push({ name: current.name, content: current.parts.join(' ').trim() });
      }
      current = { name: tag[1] ?? '', parts: [tag[2] ?? ''] };
    } else if (current !== null) {
      current.parts.push(line.trim());
    } else if (inSummary) {
      if (line.trim() === '' && summary.length > 0) {
        inSummary = false;
      } else if (line.trim() !== '') {
        summary.push(line.trim());
      }
    }
  }
  if (current !== null) {
    tags.push({ name: current.name, content: current.parts.join(' ').trim() });
  }
  return { summary: summary.join(' '), tags };
}

/** The first tag with that name, if any. */
export function findTag(block: DocBlock, name: string): DocTag | undefined {
  return block.tags.find((tag) => tag.name === name);
}

/**
 * Reduces a description to its first sentence. A leading one-word sentence such as "Optional." is kept
 * together with the sentence that follows it, so "Optional. The handle." survives whole.
 */
export function firstSentence(text: string): string {
  const cleaned = text
    .replace(/^\{\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = cleaned.split(/(?<=\.)\s+(?=[A-Z('"`])/);
  const first = sentences[0] ?? '';
  if (/^\w+\.$/.test(first) && sentences.length > 1) {
    return `${first} ${sentences[1] ?? ''}`;
  }
  return first;
}

/** The version at the start of a `@since` or `@deprecated` tag, or the whole content when there is none. */
export function versionOf(content: string): string {
  const match = VERSION.exec(content.trim());
  return match === null ? content.trim() : (match[1] ?? '');
}

/** The version a `@deprecated` tag names, or `''` when the tag has no version. */
export function deprecatedVersion(content: string): string {
  const match = VERSION.exec(content.trim());
  return match === null ? '' : (match[1] ?? '');
}
