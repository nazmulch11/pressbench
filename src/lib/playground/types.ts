import type { Result } from '@/lib/result';

/** PHP versions the Playground runtime ships. Mirrors `SupportedPHPVersions` from `@wp-playground/client`. */
export const PHP_VERSION_OPTIONS = ['8.5', '8.4', '8.3', '8.2', '8.1', '8.0', '7.4'] as const;

export type PhpVersion = (typeof PHP_VERSION_OPTIONS)[number];

/** Narrows a string (for example a `<select>` value) to a supported PHP version. */
export function isPhpVersion(value: string): value is PhpVersion {
  return (PHP_VERSION_OPTIONS as readonly string[]).includes(value);
}

/** WordPress versions offered by the spike panel. `latest` is whatever the remote considers current. */
export const WORDPRESS_VERSION_OPTIONS = ['latest', '6.9', '6.8'] as const;

export const DEFAULT_VERSIONS: RequestedVersions = { wp: 'latest', php: '8.3' };

/**
 * Folder kept in the browser's origin-private file system when `persist` is on. Phase 7 replaces this single
 * folder with one mount per project.
 */
export const PERSISTENT_DIR = '/wordpress/wp-content/plugins/pressbench-spike';

/** What to boot. */
export interface RequestedVersions {
  /** A WordPress version such as `6.8`, or `latest`. */
  readonly wp: string;
  readonly php: PhpVersion;
}

/** What WordPress reports once running, for example `6.8.2` and `8.3.33`. */
export interface PlaygroundVersions {
  readonly wp: string;
  readonly php: string;
}

/** What to boot, and where. */
export interface BootOptions {
  /** The iframe WordPress renders into. Required by the browser implementation, ignored by the others. */
  readonly iframe?: HTMLIFrameElement;
  readonly versions?: Partial<RequestedVersions>;
  /** Mount `PERSISTENT_DIR` on the origin-private file system so its files survive a reload. */
  readonly persist?: boolean;
}

export type PlaygroundErrorKind = 'not-booted' | 'boot-failed' | 'php-error' | 'io' | 'unknown';

/** Why a service call failed. `php-error` carries what PHP printed. */
export interface PlaygroundError {
  readonly kind: PlaygroundErrorKind;
  /** One line a user can read. */
  readonly message: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly output?: string;
}

/** What a successful PHP run printed. */
export interface PhpOutput {
  /** Everything PHP printed to stdout. */
  readonly output: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type PhpRunResult = Result<PhpOutput, PlaygroundError>;

/** An HTTP response from the WordPress site, decoded as text. */
export interface HttpResponse {
  readonly status: number;
  readonly body: string;
}

/**
 * Whether `PERSISTENT_DIR` survives a reload: not requested (`off`), mounted (`on`), or requested but refused by
 * the browser (`unavailable`, with the browser's reason). WebKit refuses it inside the cross-origin iframe.
 */
export type PersistenceMode = 'off' | 'on' | 'unavailable';

export interface ReadyInfo {
  /** Milliseconds from `boot()` to the runtime reporting ready. */
  readonly bootMs: number;
  readonly versions: PlaygroundVersions;
  readonly persistence: PersistenceMode;
  /** Why persistence is unavailable, in the browser's words. Only set when `persistence` is `unavailable`. */
  readonly persistenceReason?: string;
}

/** The service's lifecycle, one state at a time. */
export type PlaygroundState =
  | { readonly status: 'idle' }
  | { readonly status: 'booting' }
  | ({ readonly status: 'ready' } & ReadyInfo)
  | { readonly status: 'error'; readonly error: PlaygroundError };

/**
 * Everything the rest of Pressbench may do with WordPress Playground. Implemented by the browser service,
 * the Node service used in integration tests, and the fake used in unit and component tests.
 * Every method that can fail returns a `Result`; none of them throw.
 */
export interface PlaygroundService {
  readonly state: PlaygroundState;
  /** Calls `listener` after every state change. Returns the unsubscribe function. */
  subscribe(listener: (state: PlaygroundState) => void): () => void;
  boot(options?: BootOptions): Promise<Result<ReadyInfo, PlaygroundError>>;
  /** Runs a PHP snippet (including the `<?php` tag) and returns what it printed. */
  run(code: string): Promise<PhpRunResult>;
  writeFile(path: string, content: string): Promise<Result<void, PlaygroundError>>;
  readFile(path: string): Promise<Result<string, PlaygroundError>>;
  fileExists(path: string): Promise<Result<boolean, PlaygroundError>>;
  listFiles(directory: string): Promise<Result<readonly string[], PlaygroundError>>;
  /** Activates a plugin by its path relative to `wp-content/plugins`, for example `hello/hello.php`. */
  activatePlugin(pluginFile: string): Promise<Result<void, PlaygroundError>>;
  /** The versions WordPress itself reports, which may differ from what was requested. */
  getVersions(): Promise<Result<PlaygroundVersions, PlaygroundError>>;
  /** Performs an HTTP request against the site, for example `/wp-admin/`, without touching the iframe. */
  request(path: string): Promise<Result<HttpResponse, PlaygroundError>>;
  /** Navigates the preview iframe. */
  goTo(path: string): Promise<Result<void, PlaygroundError>>;
  getCurrentUrl(): Promise<Result<string, PlaygroundError>>;
  /** Flushes `PERSISTENT_DIR` to durable storage. A no-op where nothing is mounted. */
  persist(): Promise<Result<void, PlaygroundError>>;
  dispose(): Promise<void>;
}
