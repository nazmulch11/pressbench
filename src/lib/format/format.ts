import type { Options, Plugin } from 'prettier';

import { createLogger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/result';

const log = createLogger('editor');

/** Why formatting did not happen. `unsupported` is expected for PHP until a PHP formatter arrives (V2). */
export interface FormatError {
  readonly kind: 'unsupported' | 'syntax' | 'failed';
  /** A sentence for the user. */
  readonly message: string;
}

type Parser = 'babel' | 'babel-ts' | 'css' | 'scss' | 'less' | 'json';

const PARSERS: Readonly<Record<string, Parser>> = {
  js: 'babel',
  mjs: 'babel',
  cjs: 'babel',
  jsx: 'babel',
  ts: 'babel-ts',
  tsx: 'babel-ts',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
};

/**
 * Prettier options close to the WordPress JavaScript coding standards (`@wordpress/prettier-config` without
 * its fork-only `parenSpacing`): tabs, 80 columns, single quotes, ES5 trailing commas.
 */
export const FORMAT_OPTIONS: Options = {
  useTabs: true,
  tabWidth: 4,
  printWidth: 80,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  semi: true,
  arrowParens: 'always',
};

/** The Prettier parser for a file, or `null` when Pressbench cannot format that kind of file. */
export function formatParserFor(path: string): Parser | null {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return path.includes('.') ? (PARSERS[extension] ?? null) : null;
}

/** Whether `formatSource` can format this file. */
export function canFormat(path: string): boolean {
  return formatParserFor(path) !== null;
}

/** Loads only the Prettier plugins the parser needs; Vite splits them into their own chunks. */
async function pluginsFor(parser: Parser): Promise<Plugin[]> {
  if (parser === 'css' || parser === 'scss' || parser === 'less') {
    const postcss = await import('prettier/plugins/postcss');
    return [postcss.default];
  }
  const [babel, estree] = await Promise.all([
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);
  return [babel.default, estree.default];
}

/**
 * Formats JavaScript, TypeScript, CSS, SCSS, Less or JSON with Prettier. Other files (PHP, HTML, Markdown)
 * return an `unsupported` error; a file that does not parse returns a `syntax` error with Prettier's message.
 */
export async function formatSource(
  path: string,
  source: string,
): Promise<Result<string, FormatError>> {
  const parser = formatParserFor(path);
  if (parser === null) {
    return err({
      kind: 'unsupported',
      message: 'Formatting is available for JavaScript, TypeScript, CSS, SCSS and JSON files only.',
    });
  }
  try {
    const [{ format }, plugins] = await Promise.all([
      import('prettier/standalone'),
      pluginsFor(parser),
    ]);
    return ok(await format(source, { ...FORMAT_OPTIONS, parser, plugins }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isSyntax = error instanceof SyntaxError || /\(\d+:\d+\)/.test(message);
    log.warn('format failed', { path, kind: isSyntax ? 'syntax' : 'failed' });
    return err({
      kind: isSyntax ? 'syntax' : 'failed',
      message: isSyntax
        ? `The file could not be formatted because it has a syntax error: ${firstLine(message)}`
        : `Formatting failed: ${firstLine(message)}`,
    });
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? text;
}
