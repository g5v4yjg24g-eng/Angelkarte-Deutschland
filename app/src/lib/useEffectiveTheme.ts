import { useSyncExternalStore } from 'react';
import { effectiveTheme, subscribeTheme } from './theme';

export function useEffectiveTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribeTheme,
    () => effectiveTheme(),
    () => 'light',
  );
}
