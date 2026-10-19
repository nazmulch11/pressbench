import { useSyncExternalStore } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

function readScheme(): 'light' | 'dark' {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark' || forced === 'light') {
    return forced;
  }
  if (typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The colour scheme the app's tokens use: `data-theme` on `<html>` wins, then the system preference. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, readScheme, () => 'light');
}
