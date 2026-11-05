/** Build-time settings read through `import.meta.env`. Set them in the environment of `vite build`. */
interface ImportMetaEnv {
  /** Playground remote page to boot instead of the hosted one; E2E builds set it (see docs/TESTING.md). */
  readonly VITE_PLAYGROUND_REMOTE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
