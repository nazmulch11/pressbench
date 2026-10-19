import './app/debug-globals';
import './ui/tokens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createLogger, initLoggingFromUrl } from './lib/logger';

const logging = initLoggingFromUrl(window.location.search);
if (logging.isBufferEnabled) {
  window.__PRESSBENCH_LOGS__ = logging.buffer;
}

const log = createLogger('ui');
const rootElement = document.getElementById('root');

if (rootElement === null) {
  log.error('Root element #root is missing from index.html');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
