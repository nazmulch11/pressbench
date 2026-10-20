import { loadWordPressData } from '@/lib/wp-data';

import { registerWordPressProviders, type ProviderHost } from './providers';

/** One registration per Monaco instance (one per page in practice); a failed load may be retried. */
const setups = new WeakMap<object, Promise<boolean>>();

/**
 * Loads the WordPress data and registers the completion and hover providers once per Monaco instance.
 * Resolves `true` when the providers are in place, `false` when the data could not be loaded.
 */
export function ensureWordPressProviders(monaco: ProviderHost): Promise<boolean> {
  const existing = setups.get(monaco);
  if (existing !== undefined) {
    return existing;
  }
  const setup = loadWordPressData().then((loaded) => {
    if (!loaded.ok) {
      setups.delete(monaco);
      return false;
    }
    registerWordPressProviders(monaco, loaded.value);
    return true;
  });
  setups.set(monaco, setup);
  return setup;
}
