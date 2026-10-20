const REFERENCE = 'https://developer.wordpress.org/reference';

/** The code reference page of a global function. */
export function functionDocsUrl(name: string): string {
  return `${REFERENCE}/functions/${name}/`;
}

/**
 * The code reference page of a hook. Dynamic names use the reference's own slug form: `activate_{$plugin}` is
 * `activate_plugin`, and `{$new_status}_{$post->post_type}` is `new_status_post-post_type`.
 */
export function hookDocsUrl(name: string): string {
  const slug = name
    .replace(/\{\$?([^}]+)\}/g, '$1')
    .replace(/->/g, '-')
    .replace(/[^\w-]+/g, '_');
  return `${REFERENCE}/hooks/${slug}/`;
}
