// Ort der Vorhersage: Standort (Standard) oder ein Gewässer aus dem Fangbuch; Wahl pro Gerät gemerkt.
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { groupByWater } from '../../domain/waterGroups';
import { de } from '../../i18n/de';

const KEY = 'fangpunkt.forecastPlace';

export interface PlaceOption {
  key: string;
  label: string;
  sub?: string | undefined;
  lat: number;
  lng: number;
}

function readChoice(): string {
  try {
    return localStorage.getItem(KEY) ?? 'me';
  } catch {
    return 'me';
  }
}

/** Gewässer aus dem Fangbuch (mit Fangort), zuletzt befischt zuerst. */
export function useWaterOptions(): PlaceOption[] | undefined {
  const catches = useLiveQuery(() => getDb().catches.toArray(), []);
  return useMemo(() => {
    if (!catches) return undefined;
    const out: PlaceOption[] = [];
    for (const g of groupByWater(catches)) {
      const pos = catches.find((c) => g.ids.includes(c.id) && c.position)?.position;
      if (pos)
        out.push({
          key: g.key,
          label: g.name ?? de.catches.unknownWater,
          sub: g.place,
          lat: pos.lat,
          lng: pos.lng,
        });
    }
    return out;
  }, [catches]);
}

export function useForecastChoice() {
  const [choice, setChoice] = useState(readChoice);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // nur Komfort
    }
  }, [choice]);
  return [choice, setChoice] as const;
}

export type GeoState =
  { status: 'idle' | 'locating' } | { status: 'ok'; lat: number; lng: number } | { status: 'denied' };

/** Standort einmalig (nur solange `active`). Der Browser fragt ggf. um Erlaubnis. */
export function useCurrentPosition(active: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'idle' });
  useEffect(() => {
    if (!active) return;
    if (!('geolocation' in navigator)) {
      queueMicrotask(() => setState({ status: 'denied' }));
      return;
    }
    let alive = true;
    queueMicrotask(() => alive && setState({ status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      (p) => alive && setState({ status: 'ok', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => alive && setState({ status: 'denied' }),
      { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 20_000 },
    );
    return () => {
      alive = false;
    };
  }, [active]);
  return state;
}
