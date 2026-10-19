/** Monaco language ids by file extension (lower case, without the dot). */
const LANGUAGES: Readonly<Record<string, string>> = {
  php: 'php',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  txt: 'plaintext',
};

/** The Monaco language id for a project path; `plaintext` when the extension is unknown or missing. */
export function languageForPath(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return 'plaintext';
  }
  return LANGUAGES[name.slice(dot + 1).toLowerCase()] ?? 'plaintext';
}
