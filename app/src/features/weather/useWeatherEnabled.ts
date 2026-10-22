import { useBoolSetting } from '../settings/useBoolSetting';

/** Einstellung „Wetter am Fang"; undefined, solange sie lädt. Standard: an (Entscheidung 2026-10-22). */
export function useWeatherEnabled(): boolean | undefined {
  return useBoolSetting('weatherEnabled', true);
}
