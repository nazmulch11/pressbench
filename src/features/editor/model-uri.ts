/**
 * `file:///my-plugin/my-plugin.php`: the URI of the Monaco model for a project file. Each segment is
 * percent-encoded because Monaco parses the string as a URI: a raw `#` would start a fragment (so the model's path
 * would stop there) and `a%20b.txt` would name the same model as `a b.txt`.
 */
export function modelUri(path: string): string {
  return `file:///${path.split('/').map(encodeURIComponent).join('/')}`;
}
