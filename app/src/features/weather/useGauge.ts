// Nächster Pegel zum gewählten Ort: Stationsliste (mit aktuellen Werten) höchstens alle 30 min neu laden und
// pro Gerät zwischenspeichern; danach die 24-h-Reihe des einen Pegels für die Tendenz.
import { useEffect, useState } from 'react';
import { useProviders } from '../../ports/providersContext';
import {
  changeOver,
  GAUGE_RADIUS_KM,
  GaugeListSchema,
  nearestGauge,
  type GaugeList,
  type NearestGauge,
} from '../../domain/gauges';

const KEY = 'fangpunkt.gauges';
const MAX_AGE_MS = 30 * 60_000;

function readCache(): GaugeList | undefined {
  try {
    const r = GaugeListSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

export type GaugeState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ok';
      nearest?: NearestGauge | undefined;
      fetchedAt: number;
      stale: boolean;
      change24h?: number | undefined;
    };

export function useGauge(pos: { lat: number; lng: number } | undefined): GaugeState {
  const { gauges } = useProviders();
  const [list, setList] = useState<{ data?: GaugeList | undefined; stale: boolean; error: boolean }>(() => ({
    data: readCache(),
    stale: false,
    error: false,
  }));
  const [change, setChange] = useState<{ uuid: string; v?: number | undefined }>();

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return;
    let alive = true;
    gauges
      .stations()
      .then((stations) => {
        if (!alive) return;
        if (!stations) throw new Error('unbrauchbare Antwort');
        const data = { fetchedAt: Date.now(), stations };
        try {
          localStorage.setItem(KEY, JSON.stringify(data));
        } catch {
          // nur Komfort
        }
        setList({ data, stale: false, error: false });
      })
      .catch(() => alive && setList((l) => ({ ...l, stale: !!l.data, error: !l.data })));
    return () => {
      alive = false;
    };
  }, [gauges]);

  const lat = pos?.lat;
  const lng = pos?.lng;
  const nearest =
    list.data && lat !== undefined && lng !== undefined
      ? nearestGauge(list.data.stations, { lat, lng })
      : undefined;
  const uuid = nearest && nearest.km <= GAUGE_RADIUS_KM ? nearest.station.uuid : undefined;

  useEffect(() => {
    if (!uuid) return;
    let alive = true;
    gauges
      .waterLevel24h(uuid)
      .then((pts) => alive && setChange({ uuid, v: changeOver(pts) }))
      .catch(() => alive && setChange({ uuid }));
    return () => {
      alive = false;
    };
  }, [gauges, uuid]);

  if (list.error) return { status: 'error' };
  if (!list.data) return { status: 'loading' };
  return {
    status: 'ok',
    nearest,
    fetchedAt: list.data.fetchedAt,
    stale: list.stale,
    change24h: change?.uuid === uuid ? change?.v : undefined,
  };
}
