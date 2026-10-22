import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, type Settings } from '../../data/settings';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** Ein-/Aus-Einstellung mit Standardwert; undefined, solange sie lädt. */
export function useBoolSetting(key: BoolKey, fallback: boolean): boolean | undefined {
  return useLiveQuery(async () => (await getSetting(key)) ?? fallback, [key, fallback]);
}
