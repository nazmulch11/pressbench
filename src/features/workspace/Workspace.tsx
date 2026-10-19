import type { ReactNode } from 'react';

import { LAYOUT_LIMITS, useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';
import { Splitter } from '@/ui/Splitter';

import { CloseTabDialog } from './CloseTabDialog';
import { CommandPalette } from './CommandPalette';
import { EditorArea } from './EditorArea';
import { TabBar } from './TabBar';
import { useShortcuts } from './useShortcuts';
import styles from './Workspace.module.css';

export interface WorkspaceProps {
  /** What the sidebar shows: the file tree. Composed by the app, since features do not import each other. */
  sidebar?: ReactNode;
  /** What the preview area shows (Phase 2: the Playground spike panel). */
  preview?: ReactNode;
  /**
   * The code editor for the active file (Phase 3: Monaco from `features/editor`). Without it the editor area
   * falls back to a plain text area, which is what component tests render.
   */
  editor?: ReactNode;
}

/**
 * The IDE layout: header, file tree, editor column (tabs, editor, bottom panel) and preview, split by
 * keyboard-operable splitters whose sizes are remembered per browser.
 */
export function Workspace({ sidebar, preview, editor }: WorkspaceProps): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const layout = useWorkspaceStore((state) => state.layout);
  useShortcuts();

  const columns = [
    layout.visible.sidebar ? `${String(layout.sizes.sidebar)}px auto` : null,
    'minmax(0, 1fr)',
    layout.visible.preview ? `auto ${String(layout.sizes.preview)}px` : null,
  ]
    .filter((column) => column !== null)
    .join(' ');

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Pressbench</h1>
        <p className={styles.tagline}>Browser IDE for WordPress plugins and themes</p>
        <button
          type="button"
          className={styles.commandsButton}
          onClick={() => {
            api.getState().openPalette();
          }}
        >
          Commands <kbd className={styles.kbd}>Ctrl/Cmd+K</kbd>
        </button>
      </header>
      <main className={styles.main} style={{ gridTemplateColumns: columns }}>
        {layout.visible.sidebar ? (
          <>
            <section className={styles.sidebar} aria-label="Files">
              {sidebar}
            </section>
            <Splitter
              label="Resize sidebar"
              orientation="vertical"
              value={layout.sizes.sidebar}
              min={LAYOUT_LIMITS.sidebar.min}
              max={LAYOUT_LIMITS.sidebar.max}
              step={LAYOUT_LIMITS.sidebar.step}
              onChange={(value) => {
                api.getState().setPanelSize('sidebar', value, false);
              }}
              onCommit={(value) => {
                api.getState().setPanelSize('sidebar', value);
              }}
            />
          </>
        ) : null}
        <div className={styles.column}>
          <section className={styles.editor} aria-label="Editor">
            <TabBar />
            <EditorArea editor={editor} />
          </section>
          {layout.visible.bottom ? (
            <>
              <Splitter
                label="Resize bottom panel"
                orientation="horizontal"
                invert
                value={layout.sizes.bottom}
                min={LAYOUT_LIMITS.bottom.min}
                max={LAYOUT_LIMITS.bottom.max}
                step={LAYOUT_LIMITS.bottom.step}
                onChange={(value) => {
                  api.getState().setPanelSize('bottom', value, false);
                }}
                onCommit={(value) => {
                  api.getState().setPanelSize('bottom', value);
                }}
              />
              <section
                className={styles.bottom}
                aria-label="Bottom panel"
                style={{ height: layout.sizes.bottom }}
              >
                <h2 className={styles.panelTitle}>Problems</h2>
                <p className={styles.hint}>
                  PHP errors and the debug log arrive here in Phase 6. Nothing to show yet.
                </p>
              </section>
            </>
          ) : null}
        </div>
        {layout.visible.preview ? (
          <>
            <Splitter
              label="Resize preview"
              orientation="vertical"
              invert
              value={layout.sizes.preview}
              min={LAYOUT_LIMITS.preview.min}
              max={LAYOUT_LIMITS.preview.max}
              step={LAYOUT_LIMITS.preview.step}
              onChange={(value) => {
                api.getState().setPanelSize('preview', value, false);
              }}
              onCommit={(value) => {
                api.getState().setPanelSize('preview', value);
              }}
            />
            <section className={styles.preview} aria-label="Preview">
              {preview ?? <p className={styles.hint}>The WordPress preview arrives in Phase 4.</p>}
            </section>
          </>
        ) : null}
      </main>
      <CommandPalette />
      <CloseTabDialog />
    </div>
  );
}
