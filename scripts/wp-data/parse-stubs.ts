/**
 * Reads global functions out of `php-stubs/wordpress-stubs` (`wordpress-stubs.php`). The stubs put
 * everything inside `namespace { … }` blocks with four-space indentation, so a global function is a line that
 * starts with `    function `, optionally preceded by a docblock at the same indentation. Methods are indented
 * deeper and functions in other namespaces (PHPMailer, Requests) are skipped.
 */
import {
  deprecatedVersion,
  findTag,
  firstSentence,
  parseDocBlock,
  versionOf,
  type DocBlock,
} from './docblock';
import type { WordPressFunction, WordPressParam } from '../../src/lib/wp-data/types';

const GLOBAL_NAMESPACE = /^namespace\s*\{/;
const OTHER_NAMESPACE = /^namespace\s+\S+\s*\{/;
const DOC_START = /^ {4}\/\*\*/;
const DOC_END = /^\s*\*\/$/;
const ONE_LINE_DOC = /^ {4}\/\*\*(.*)\*\/\s*$/;
const FUNCTION_START = /^ {4}function\s+&?(\w+)\s*\(/;
const PARAM_TAG = /^(\S+)\s+(&?\.{0,3}\$\w+)\s*(.*)$/s;

interface Signature {
  readonly params: readonly string[];
  readonly returns: string | undefined;
}

/** Parses the whole stubs file and returns every public global function in file order. */
export function parseStubs(source: string): WordPressFunction[] {
  const functions: WordPressFunction[] = [];
  const lines = source.split('\n');
  let inGlobal = false;
  let pendingDoc: string[] | null = null;
  let doc: DocBlock | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (GLOBAL_NAMESPACE.test(line) || OTHER_NAMESPACE.test(line)) {
      inGlobal = GLOBAL_NAMESPACE.test(line);
      doc = null;
      continue;
    }
    if (!inGlobal) {
      continue;
    }
    if (pendingDoc !== null) {
      if (DOC_END.test(line)) {
        doc = parseDocBlock(pendingDoc.join('\n'));
        pendingDoc = null;
      } else {
        pendingDoc.push(line);
      }
      continue;
    }
    const oneLine = ONE_LINE_DOC.exec(line);
    if (oneLine !== null) {
      doc = parseDocBlock(oneLine[1] ?? '');
      continue;
    }
    if (DOC_START.test(line)) {
      pendingDoc = [];
      continue;
    }
    const start = FUNCTION_START.exec(line);
    if (start !== null) {
      const { text, end } = readSignature(lines, index);
      const parsed = toFunction(start[1] ?? '', text, doc);
      if (parsed !== null) {
        functions.push(parsed);
      }
      index = end;
      doc = null;
    } else if (line.trim() !== '' && !line.startsWith('    #[')) {
      doc = null;
    }
  }
  return functions;
}

/** Joins the lines of a declaration until its parameter list closes. */
function readSignature(lines: readonly string[], from: number): { text: string; end: number } {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    parts.push(line.trim());
    for (const char of line) {
      if (quote !== null) {
        quote = char === quote ? null : quote;
      } else if (char === "'" || char === '"') {
        quote = char;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          return { text: parts.join(' '), end: index };
        }
      }
    }
  }
  return { text: parts.join(' '), end: lines.length - 1 };
}

function toFunction(name: string, text: string, doc: DocBlock | null): WordPressFunction | null {
  if (doc !== null && isPrivate(doc)) {
    return null;
  }
  const signature = splitSignature(text);
  const returns = signature.returns ?? returnTypeOf(doc);
  const since = doc === null ? undefined : findTag(doc, 'since')?.content;
  const deprecated = doc === null ? undefined : findTag(doc, 'deprecated')?.content;
  return {
    name,
    signature: signature.params.length === 0 ? '()' : `( ${signature.params.join(', ')} )`,
    summary: doc?.summary ?? '',
    params: signature.params.map((param) => toParam(param, doc)),
    ...(returns === undefined ? {} : { returns }),
    ...(since === undefined ? {} : { since: versionOf(since) }),
    ...(deprecated === undefined ? {} : { deprecated: deprecatedVersion(deprecated) }),
  };
}

function isPrivate(doc: DocBlock): boolean {
  return findTag(doc, 'access')?.content === 'private' || findTag(doc, 'ignore') !== undefined;
}

function returnTypeOf(doc: DocBlock | null): string | undefined {
  const content = doc === null ? undefined : findTag(doc, 'return')?.content;
  const type = content?.split(/\s+/)[0];
  return type === undefined || type === '' ? undefined : stripSlashes(type);
}

/** `name(a, b = array()) : ?\Type` → normalised parameter strings and the declared return type. */
function splitSignature(text: string): Signature {
  const open = text.indexOf('(');
  const inner = text.slice(open + 1);
  const params: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  let index = 0;
  for (; index < inner.length; index += 1) {
    const char = inner[index] ?? '';
    if (quote !== null) {
      current += char;
      quote = char === quote ? null : quote;
    } else if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === '(') {
      depth += 1;
      current += char;
    } else if (char === ')') {
      if (depth === 0) {
        break;
      }
      depth -= 1;
      current += char;
    } else if (char === ',' && depth === 0) {
      params.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  params.push(current);
  const returns = /^\s*:\s*([^\s{]+)/.exec(inner.slice(index + 1))?.[1];
  return {
    params: params.map(normaliseParam).filter((param) => param !== ''),
    returns: returns === undefined ? undefined : stripSlashes(returns),
  };
}

/** Drops attributes such as `#[\SensitiveParameter]` and collapses whitespace. */
function normaliseParam(param: string): string {
  return stripSlashes(
    param
      .replace(/#\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** The stubs write fully qualified names (`\false`, `\WP_Error`); users never do. */
function stripSlashes(text: string): string {
  return text.replace(/\\(?=[\w?])/g, '');
}

function toParam(param: string, doc: DocBlock | null): WordPressParam {
  const name = /\$\w+/.exec(param)?.[0] ?? param;
  const signatureType = param.slice(0, param.indexOf('$')).replace(/[&.\s]/g, '');
  const tag = doc?.tags.find((candidate) => {
    const match = candidate.name === 'param' ? PARAM_TAG.exec(candidate.content) : null;
    return match !== null && match[2]?.replace(/^[&.]+/, '') === name;
  });
  const match = tag === undefined ? null : PARAM_TAG.exec(tag.content);
  const type = match?.[1] ?? (signatureType === '' ? undefined : signatureType);
  const description = match?.[3] === undefined ? '' : firstSentence(match[3]);
  return {
    name,
    ...(type === undefined ? {} : { type: stripSlashes(type) }),
    ...(description === '' ? {} : { description }),
  };
}
