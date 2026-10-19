import './app/debug-globals';
import './ui/tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { CodeEditor } from './features/editor';
import { createLogger, initLoggingFromUrl } from './lib/logger';
import { createWebPlaygroundService } from './lib/playground';
import { browserLocalStorage, createPreferences } from './lib/storage';
import { createWorkspaceStore } from './stores';

const logging = initLoggingFromUrl(window.location.search);
const isDebug = logging.isBufferEnabled;
if (isDebug) {
  window.__PRESSBENCH_LOGS__ = logging.buffer;
}

const playground = createWebPlaygroundService({
  onClientConnected: (client) => {
    if (isDebug) {
      window.__PRESSBENCH__ = { ...window.__PRESSBENCH__, playground: client };
    }
  },
});
const store = createWorkspaceStore({ preferences: createPreferences(browserLocalStorage()) });
if (isDebug) {
  window.__PRESSBENCH__ = {
    ...window.__PRESSBENCH__,
    playgroundService: playground,
    workspaceStore: store,
  };
}

const log = createLogger('ui');
const rootElement = document.getElementById('root');

if (rootElement === null) {
  log.error('Root element #root is missing from index.html');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App playground={playground} store={store} editor={<CodeEditor />} />
    </StrictMode>,
  );
}
