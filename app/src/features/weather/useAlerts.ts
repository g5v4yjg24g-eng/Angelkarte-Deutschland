// Amtliche Warnungen laden: zuletzt geladene sofort zeigen (pro Gerät gespeichert), online neu holen.
// Abgelaufene Warnungen blendet die Anzeige aus (alertsBetween).
import { useCallback, useEffect, useState } from 'react';
import { useProviders } from '../../ports/providersContext';
import { AlertsSchema, type Alerts, type AlertsQuery } from '../../domain/alerts';

const CACHE_PREFIX = 'fangpunkt.alerts:';
const CACHE_PLACES = 5;
const keyOf = (q: AlertsQuery) => `${CACHE_PREFIX}${q.lat.toFixed(3)},${q.lng.toFixed(3)}`;

function readCache(q: AlertsQuery): Alerts | undefined {
  try {
    const r = AlertsSchema.safeParse(JSON.parse(localStorage.getItem(keyOf(q)) ?? 'null'));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(f: Alerts) {
  try {
    // Letzte Warnungen je Ort, höchstens CACHE_PLACES Orte (Wetter-Seite + Kalendertermine); älteste fliegen raus
    localStorage.setItem(keyOf(f), JSON.stringify(f));
    const entries: { k: string; at: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(CACHE_PREFIX)) continue;
      const at = (JSON.parse(localStorage.getItem(k) ?? 'null') as { fetchedAt?: number } | null)?.fetchedAt;
      entries.push({ k, at: at ?? 0 });
    }
    entries
      .sort((a, b) => b.at - a.at)
      .slice(CACHE_PLACES)
      .forEach((e) => localStorage.removeItem(e.k));
  } catch {
    // nur Komfort
  }
}

export type AlertsLoadState =
  | { status: 'idle' }
  | { status: 'loading'; cached?: Alerts | undefined }
  | { status: 'ok'; data: Alerts; stale: boolean }
  | { status: 'error'; offline: boolean };

export function useAlerts(q: AlertsQuery | undefined): { state: AlertsLoadState; reload: () => void } {
  const { alerts } = useProviders();
  const [state, setState] = useState<AlertsLoadState>({ status: 'idle' });
  const [round, setRound] = useState(0);
  const lat = q?.lat;
  const lng = q?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const query = { lat, lng };
    let alive = true;
    const cached = readCache(query);
    queueMicrotask(() => alive && setState({ status: 'loading', cached }));
    alerts
      .alerts(query)
      .then((f) => {
        if (!alive) return;
        if (!f) throw new Error('unbrauchbare Antwort');
        writeCache(f);
        setState({ status: 'ok', data: f, stale: false });
      })
      .catch(() => {
        if (!alive) return;
        setState(
          cached
            ? { status: 'ok', data: cached, stale: true }
            : { status: 'error', offline: !navigator.onLine },
        );
      });
    return () => {
      alive = false;
    };
  }, [alerts, lat, lng, round]);
  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { state, reload };
}
