/**
 * Shapes of the generated WordPress data in `src/data/` (produced by `npm run generate:wp-data`, see
 * `scripts/generate-wp-data.ts`). Shared by the generator and the editor's completion and hover providers.
 */

/** Where a data file came from, so a reviewer can tell which WordPress version it describes. */
export interface DataSource {
  /** Package or repository name, for example `php-stubs/wordpress-stubs`. */
  readonly name: string;
  /** The exact tag or package version the file was generated from. */
  readonly version: string;
  /** Where that version lives. */
  readonly url: string;
  /** SPDX licence of the source. */
  readonly licence: string;
  /** The WordPress version the source describes, when the source states it. */
  readonly wordpress?: string;
}

/** One parameter of a function or hook. */
export interface WordPressParam {
  /** Including the `$`, for example `$handle`. */
  readonly name: string;
  /** PHP type from the docblock or the signature, for example `string|bool|null`. */
  readonly type?: string;
  /** First sentence of the docblock description. */
  readonly description?: string;
}

/** A global WordPress function. */
export interface WordPressFunction {
  readonly name: string;
  /** The parameter list in WordPress style, for example `( $handle, $src = '', $deps = array() )`. */
  readonly signature: string;
  /** First paragraph of the docblock. */
  readonly summary: string;
  readonly params: readonly WordPressParam[];
  /** Return type, when documented. */
  readonly returns?: string;
  /** Version the function was added in. */
  readonly since?: string;
  /** Present when the function is deprecated; holds the version it was deprecated in, or `''` if unknown. */
  readonly deprecated?: string;
}

export type HookType = 'action' | 'filter';

/** A WordPress action or filter. */
export interface WordPressHook {
  readonly name: string;
  readonly type: HookType;
  readonly summary: string;
  readonly params: readonly WordPressParam[];
  readonly since?: string;
  /** Present when the hook is deprecated; holds the version it was deprecated in, or `''` if unknown. */
  readonly deprecated?: string;
}

/** `src/data/wp-functions.json`. */
export interface WordPressFunctionsFile {
  readonly source: DataSource;
  readonly functions: readonly WordPressFunction[];
}

/** `src/data/wp-hooks.json`. */
export interface WordPressHooksFile {
  readonly source: DataSource;
  readonly hooks: readonly WordPressHook[];
}

/** Both files, loaded. */
export interface WordPressData {
  readonly functions: readonly WordPressFunction[];
  readonly hooks: readonly WordPressHook[];
}
