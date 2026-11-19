// Standort in der iPhone-App über das eigene Swift-Modul `FangpunktLocation` (CoreLocation, keine fremde Abhängigkeit).
// Grund: Über `navigator.geolocation` fragt die Web-Ansicht bei jedem Start noch einmal nach; CoreLocation fragt nur
// einmal (iOS merkt sich die Antwort). Mehrere Zuhörer teilen sich eine Messung: sie startet beim ersten und endet beim
// letzten. Fehler sind egal: ein fehlender Standort darf nie etwas anderes stören.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { LocationError, LocationFix, LocationPermission, LocationProvider } from '../ports/location';

interface RawFix {
  lat: number;
  lng: number;
  acc: number;
  t: number;
}
interface LocationPlugin {
  permission(): Promise<{ status: string }>;
  start(p: { high: boolean }): Promise<{ state: string }>;
  stop(): Promise<void>;
  current(p: { high: boolean }): Promise<RawFix>;
  addListener(event: 'position', cb: (f: RawFix) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (e: { code: string }) => void): Promise<PluginListenerHandle>;
}

const isPermission = (s: unknown): s is LocationPermission =>
  s === 'granted' || s === 'denied' || s === 'prompt';
const toFix = (r: RawFix): LocationFix => ({ lat: r.lat, lng: r.lng, accuracy: r.acc, t: r.t });
const toError = (c: unknown): LocationError =>
  c === 'denied' ? 'denied' : c === 'timeout' ? 'timeout' : 'unavailable';

interface Sub {
  onFix: (f: LocationFix) => void;
  onError: (e: LocationError) => void;
}

export function capacitorLocation(): LocationProvider | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const plugin = registerPlugin<LocationPlugin>('FangpunktLocation');
  const subs = new Set<Sub>();
  let handles: PluginListenerHandle[] = [];
  let epoch = 0;

  const startNative = async (high: boolean) => {
    const mine = ++epoch;
    const [a, b] = await Promise.all([
      plugin.addListener('position', (f) => subs.forEach((s) => s.onFix(toFix(f)))),
      plugin.addListener('error', (e) => subs.forEach((s) => s.onError(toError(e.code)))),
    ]);
    if (mine !== epoch || subs.size === 0) {
      void a.remove();
      void b.remove();
      return;
    }
    handles = [a, b];
    const r = await plugin.start({ high });
    if (r.state !== 'granted')
      subs.forEach((s) => s.onError(r.state === 'denied' ? 'denied' : 'unavailable'));
  };
  const stopNative = () => {
    epoch++;
    handles.forEach((h) => void h.remove());
    handles = [];
    void plugin.stop().catch(() => undefined);
  };

  return {
    supported: true,
    permission: () =>
      plugin.permission().then(
        (r) => (isPermission(r.status) ? r.status : 'unknown'),
        () => 'unknown' as const,
      ),
    watch: (opts, onFix, onError) => {
      const sub: Sub = { onFix, onError };
      subs.add(sub);
      if (subs.size === 1) void startNative(opts.highAccuracy).catch(() => onError('unavailable'));
      return () => {
        subs.delete(sub);
        if (subs.size === 0) stopNative();
      };
    },
    current: (opts) =>
      new Promise<LocationFix>((resolve, reject) => {
        const timer = opts.timeoutMs
          ? setTimeout(() => reject('timeout' satisfies LocationError), opts.timeoutMs)
          : undefined;
        plugin.current({ high: opts.highAccuracy }).then(
          (r) => {
            clearTimeout(timer);
            resolve(toFix(r));
          },
          (e: unknown) => {
            clearTimeout(timer);
            reject(toError(e instanceof Error ? e.message : (e as { code?: string } | undefined)?.code));
          },
        );
      }),
  };
}
