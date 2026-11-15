// Live Activity über das eigene Swift-Modul `FangpunktLive` (nur in der iPhone-App, keine fremde Abhängigkeit).
// Fehler sind egal: eine fehlende Anzeige darf die Session nie stören.
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { LivePayload } from '../domain/liveActivity';
import type { LiveActivityProvider } from '../ports/liveActivity';

interface LivePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(p: Record<string, unknown>): Promise<void>;
  update(p: Record<string, unknown>): Promise<void>;
  end(p: Record<string, unknown>): Promise<void>;
}

const body = (p: LivePayload): Record<string, unknown> => ({
  sessionId: p.sessionId,
  state: p.state,
  title: p.title,
  timerStartMs: p.timerStartMs,
  activeSeconds: p.activeSeconds,
  catches: p.catches,
  bites: p.bites,
  ...(p.distanceKm !== undefined ? { distanceKm: p.distanceKm } : {}),
  ...(p.biggest ? { biggest: p.biggest } : {}),
});

export function capacitorLiveActivity(): LiveActivityProvider | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const plugin = registerPlugin<LivePlugin>('FangpunktLive');
  return {
    available: () =>
      plugin.isAvailable().then(
        (r) => r.available === true,
        () => false,
      ),
    start: (p) => plugin.start(body(p)).catch(() => undefined),
    update: (p) => plugin.update(body(p)).catch(() => undefined),
    end: (sessionId, payload, keepSeconds) =>
      plugin.end({ ...(payload ? body(payload) : { sessionId }), keepSeconds }).catch(() => undefined),
  };
}
