// Vibration über Capacitor (nur in der iPhone-App). Das Plugin wird nur dort geladen; Fehler sind egal – eine
// fehlende Vibration darf nie eine Aktion stören.
import { Capacitor } from '@capacitor/core';
import { NO_HAPTICS, type HapticsProvider } from '../ports/haptics';

type Plugin = typeof import('@capacitor/haptics');
let loaded: Promise<Plugin> | undefined;
const run = (fn: (m: Plugin) => Promise<unknown>) => {
  loaded ??= import('@capacitor/haptics');
  void loaded.then(fn).catch(() => undefined);
};

export function capacitorHaptics(): HapticsProvider {
  if (!Capacitor.isNativePlatform()) return NO_HAPTICS;
  return {
    available: true,
    success: () => run((m) => m.Haptics.notification({ type: m.NotificationType.Success })),
    light: () => run((m) => m.Haptics.impact({ style: m.ImpactStyle.Light })),
    selectionStart: () => run((m) => m.Haptics.selectionStart()),
    selectionChanged: () => run((m) => m.Haptics.selectionChanged()),
    selectionEnd: () => run((m) => m.Haptics.selectionEnd()),
  };
}
