import './app/debug-globals';
import './ui/tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createLogger, initLoggingFromUrl } from './lib/logger';
import { createWebPlaygroundService } from './lib/playground';

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
if (isDebug) {
  window.__PRESSBENCH__ = { ...window.__PRESSBENCH__, playgroundService: playground };
}

const log = createLogger('ui');
const rootElement = document.getElementById('root');

if (rootElement === null) {
  log.error('Root element #root is missing from index.html');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App playground={playground} />
    </StrictMode>,
  );
}
