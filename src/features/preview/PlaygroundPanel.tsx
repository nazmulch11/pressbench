import { useId, useRef, useState } from 'react';

import {
  DEFAULT_VERSIONS,
  isPhpVersion,
  PHP_VERSION_OPTIONS,
  WORDPRESS_VERSION_OPTIONS,
  type PhpVersion,
  type PlaygroundService,
  type PlaygroundState,
} from '@/lib/playground';

import styles from './PlaygroundPanel.module.css';
import { usePlaygroundState } from './usePlaygroundState';

export interface PlaygroundPanelProps {
  service: PlaygroundService;
}

function statusText(state: PlaygroundState): string {
  switch (state.status) {
    case 'idle':
      return 'Not started';
    case 'booting':
      return 'Starting WordPress…';
    case 'ready': {
      const ready = `Ready in ${(state.bootMs / 1000).toFixed(1)} s`;
      return state.persistence === 'unavailable'
        ? `${ready}. Files will not be kept: ${state.persistenceReason ?? 'storage is unavailable'}`
        : ready;
    }
    case 'error':
      return `Could not start WordPress: ${state.error.message}`;
  }
}

/**
 * Phase 1 spike panel: pick versions, start WordPress in an iframe, see the boot result. The workspace UI of
 * Phase 2 replaces this screen; the service underneath stays.
 */
export function PlaygroundPanel({ service }: PlaygroundPanelProps): React.JSX.Element {
  const state = usePlaygroundState(service);
  const headingId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [wp, setWp] = useState<string>(DEFAULT_VERSIONS.wp);
  const [php, setPhp] = useState<PhpVersion>(DEFAULT_VERSIONS.php);
  const [persist, setPersist] = useState(false);
  const isBooting = state.status === 'booting';

  function start(): void {
    const iframe = iframeRef.current;
    void service.boot({
      ...(iframe === null ? {} : { iframe }),
      versions: { wp, php },
      persist,
    });
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Playground spike
      </h2>
      <form
        className={styles.controls}
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <label className={styles.field}>
          WordPress version
          <select
            value={wp}
            onChange={(event) => {
              setWp(event.target.value);
            }}
            disabled={isBooting}
          >
            {WORDPRESS_VERSION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          PHP version
          <select
            value={php}
            onChange={(event) => {
              if (isPhpVersion(event.target.value)) {
                setPhp(event.target.value);
              }
            }}
            disabled={isBooting}
          >
            {PHP_VERSION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={persist}
            onChange={(event) => {
              setPersist(event.target.checked);
            }}
            disabled={isBooting}
          />
          Keep files between reloads
        </label>
        <button type="submit" className={styles.button} disabled={isBooting}>
          {state.status === 'error' ? 'Retry' : 'Start WordPress'}
        </button>
      </form>
      <p role="status" className={styles.status} data-status={state.status}>
        {statusText(state)}
      </p>
      <iframe ref={iframeRef} title="WordPress preview" className={styles.frame} />
    </section>
  );
}
