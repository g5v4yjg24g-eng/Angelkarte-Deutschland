import { useMemo } from 'react';
import { NO_HAPTICS, type HapticsProvider } from '../../ports/haptics';
import { useProviders } from '../../ports/providersContext';
import { useBoolSetting } from '../settings/useBoolSetting';

/** Vibration, sofern verfügbar (iPhone-App) und in den Einstellungen nicht abgeschaltet (Standard: an). */
export function useHaptics(): HapticsProvider {
  const { haptics } = useProviders();
  const enabled = useBoolSetting('haptics', true);
  return useMemo(() => (haptics.available && enabled ? haptics : NO_HAPTICS), [haptics, enabled]);
}
