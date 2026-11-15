// Live Activity über das eigene Swift-Modul `FangpunktLive` (nur in der iPhone-App, keine fremde Abhängigkeit).
// Fehler sind egal: eine fehlende Anzeige darf die Session nie stören.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parsePendingActions, type LivePayload } from '../domain/liveActivity';
import type { LiveActivityProvider } from '../ports/liveActivity';

interface LivePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(p: Record<string, unknown>): Promise<void>;
  update(p: Record<string, unknown>): Promise<void>;
  end(p: Record<string, unknown>): Promise<void>;
  takeActions(): Promise<{ actions: unknown[] }>;
  addListener(event: 'liveAction', listener: () => void): Promise<PluginListenerHandle>;
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
    takeActions: () =>
      plugin.takeActions().then(
        (r) => parsePendingActions(r.actions),
        () => [],
      ),
    onAction(listener) {
      let remove: (() => void) | undefined;
      let gone = false;
      void plugin
        .addListener('liveAction', listener)
        .then((h) => {
          if (gone) void h.remove();
          else remove = () => void h.remove();
        })
        .catch(() => undefined);
      return () => {
        gone = true;
        remove?.();
      };
    },
  };
}
