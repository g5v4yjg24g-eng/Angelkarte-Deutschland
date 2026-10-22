// Vorhersage laden: zuletzt geladene sofort zeigen (pro Gerät gespeichert), online neu holen.
import { useCallback, useEffect, useState } from 'react';
import { useProviders } from '../../ports/providersContext';
import { ForecastSchema, type Forecast, type ForecastQuery } from '../../domain/forecast';

const CACHE_PREFIX = 'fangpunkt.forecast:';
const CACHE_PLACES = 5;
const keyOf = (q: ForecastQuery) => `${CACHE_PREFIX}${q.lat.toFixed(3)},${q.lng.toFixed(3)}`;

function readCache(q: ForecastQuery): Forecast | undefined {
  try {
    const r = ForecastSchema.safeParse(JSON.parse(localStorage.getItem(keyOf(q)) ?? 'null'));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}
function writeCache(f: Forecast) {
  try {
    // Letzte Vorhersage je Ort, höchstens CACHE_PLACES Orte (Wetter-Seite + Kalendertermine); älteste fliegen raus
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

export type ForecastState =
  | { status: 'idle' }
  | { status: 'loading'; cached?: Forecast | undefined }
  | { status: 'ok'; forecast: Forecast; stale: boolean }
  | { status: 'error'; offline: boolean };

export function useForecast(q: ForecastQuery | undefined): { state: ForecastState; reload: () => void } {
  const { forecast } = useProviders();
  const [state, setState] = useState<ForecastState>({ status: 'idle' });
  const [round, setRound] = useState(0);
  const lat = q?.lat;
  const lng = q?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const query = { lat, lng };
    let alive = true;
    const cached = readCache(query);
    queueMicrotask(() => alive && setState({ status: 'loading', cached }));
    forecast
      .forecast(query)
      .then((f) => {
        if (!alive) return;
        if (!f) throw new Error('unbrauchbare Antwort');
        writeCache(f);
        setState({ status: 'ok', forecast: f, stale: false });
      })
      .catch(() => {
        if (!alive) return;
        setState(
          cached
            ? { status: 'ok', forecast: cached, stale: true }
            : { status: 'error', offline: !navigator.onLine },
        );
      });
    return () => {
      alive = false;
    };
  }, [forecast, lat, lng, round]);
  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { state, reload };
}
