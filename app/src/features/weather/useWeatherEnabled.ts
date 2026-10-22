import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../../data/settings';

/** Einstellung „Wetter am Fang"; undefined, solange sie lädt. Standard: aus. */
export function useWeatherEnabled(): boolean | undefined {
  return useLiveQuery(async () => (await getSetting('weatherEnabled')) ?? false, []);
}
