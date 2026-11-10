// Hintergrund-Route über das eigene Swift-Modul `FangpunktRoute` (nur in der iPhone-App, keine fremde Abhängigkeit).
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundRoute, RouteStart } from '../ports/backgroundRoute';
import { parseRouteFixes } from '../domain/track';

interface RoutePlugin {
  start(): Promise<{ state: RouteStart }>;
  stop(): Promise<void>;
  drain(): Promise<{ fixes: unknown[] }>;
}

export function capacitorRoute(): BackgroundRoute | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const plugin = registerPlugin<RoutePlugin>('FangpunktRoute');
  return {
    start: () =>
      plugin.start().then(
        (r) => r.state,
        () => 'unavailable' as const,
      ),
    stop: () => plugin.stop().catch(() => undefined),
    drain: () =>
      plugin.drain().then(
        (r) => parseRouteFixes(r.fixes),
        () => [],
      ),
  };
}
