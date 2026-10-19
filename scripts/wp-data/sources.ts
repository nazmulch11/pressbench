/**
 * Where the generated WordPress data comes from. Bump `STUBS_VERSION` and the `@wp-hooks/wordpress-core`
 * dependency together when a new WordPress major is released (docs/UPDATING.md section 2).
 */
import type { DataSource } from '../../src/lib/wp-data/types';

/** Git tag of php-stubs/wordpress-stubs to read functions from. */
export const STUBS_VERSION = 'v7.1.2';

/** SHA-256 of `wordpress-stubs.php` at that tag; the download is refused when it differs. */
export const STUBS_SHA256 = '556bd94cdd53a5b41781ffcbf7b98edd4e19a022c9b2ba8c29a3ff4ef936e384';

export const STUBS_SOURCE: DataSource = {
  name: 'php-stubs/wordpress-stubs',
  version: STUBS_VERSION,
  url: `https://github.com/php-stubs/wordpress-stubs/blob/${STUBS_VERSION}/wordpress-stubs.php`,
  licence: 'MIT',
  wordpress: STUBS_VERSION.replace(/^v/, ''),
};

/** Raw file for the pinned tag. */
export const STUBS_DOWNLOAD_URL = `https://raw.githubusercontent.com/php-stubs/wordpress-stubs/${STUBS_VERSION}/wordpress-stubs.php`;

export const HOOKS_PACKAGE = '@wp-hooks/wordpress-core';

/** The hooks source for the installed package version and the WordPress version its readme names. */
export function hooksSource(version: string, wordpress: string | undefined): DataSource {
  return {
    name: HOOKS_PACKAGE,
    version,
    url: `https://www.npmjs.com/package/${HOOKS_PACKAGE}/v/${version}`,
    licence: 'GPL-3.0-or-later',
    ...(wordpress === undefined ? {} : { wordpress }),
  };
}

/** Reads "Last updated for WordPress 7.1." out of the package readme. */
export function wordpressVersionFromReadme(readme: string): string | undefined {
  return /Last updated for WordPress\s+([\d.]+?)\.?(?:\s|$)/.exec(readme)?.[1];
}
