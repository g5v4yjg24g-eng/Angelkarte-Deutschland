// Wetter für Zeit und Ort des Erfassungsformulars laden (siehe FormWeather.tsx).
import { useEffect, useState } from 'react';
import type { LatLng } from '../../domain/schemas';
import {
  weatherAvailable,
  weatherQuery,
  WeatherSnapshotSchema,
  type WeatherSnapshot,
} from '../../domain/weather';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { useWeatherEnabled } from './useWeatherEnabled';

export type FormWeatherState =
  | { status: 'off' | 'noPosition' | 'unavailable' | 'offline' | 'loading' | 'none' | 'error' }
  | { status: 'ok'; snap: WeatherSnapshot; key: string };

export const weatherKey = (at: string, pos: LatLng) => {
  const q = weatherQuery(at, pos);
  return `${q.forHour}|${q.lat}|${q.lng}`;
};

/** Lädt das Wetter für Zeit und Ort des Formulars (kurz verzögert, damit Tippen in den Feldern nicht abfragt). */
export function useFormWeather(at: string | undefined, pos: LatLng | undefined): FormWeatherState {
  const { weather } = useProviders();
  const enabled = useWeatherEnabled();
  const online = useOnline();
  const key = at && pos ? weatherKey(at, pos) : '';
  const [result, setResult] = useState<{ key: string; state: FormWeatherState }>();
  const [nowMs] = useState(() => Date.now());
  const available = !!at && weatherAvailable(at, nowMs);

  useEffect(() => {
    if (!enabled || !online || !key || !available || !at || !pos) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      weather
        .fetchHour(weatherQuery(at, pos))
        .then((snap) => {
          if (!alive) return;
          const ok = snap && WeatherSnapshotSchema.safeParse(snap).success;
          setResult({ key, state: ok ? { status: 'ok', snap, key } : { status: 'none' } });
        })
        .catch(() => alive && setResult({ key, state: { status: 'error' } }));
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // at/pos stecken im key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, online, key, available, weather]);

  if (enabled === false) return { status: 'off' };
  if (!pos) return { status: 'noPosition' };
  if (!at) return { status: 'loading' };
  if (!available) return { status: 'unavailable' };
  if (!online) return { status: 'offline' };
  return result?.key === key ? result.state : { status: 'loading' };
}
