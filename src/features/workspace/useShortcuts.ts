import { useEffect } from 'react';

import { useWorkspaceStoreApi } from '@/stores';

/** True for Ctrl on Windows and Linux and for Cmd on macOS (either modifier is accepted everywhere). */
export function isPrimaryModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/**
 * Global shortcuts of the shell: Ctrl/Cmd+K opens the palette, Ctrl/Cmd+S saves, Ctrl/Cmd+W closes the active
 * tab. Later phases register their own through the palette.
 */
export function useShortcuts(): void {
  const api = useWorkspaceStoreApi();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isPrimaryModifier(event) || event.altKey || event.shiftKey) {
        return;
      }
      const state = api.getState();
      if (state.closing !== null) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'k':
          if (state.isPaletteOpen) {
            state.closePalette();
          } else {
            state.openPalette();
          }
          break;
        case 's':
          if (state.activeTab !== null) {
            state.saveFile(state.activeTab);
          }
          break;
        case 'w':
          if (state.activeTab !== null) {
            state.closeTab(state.activeTab);
          }
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [api]);
}
