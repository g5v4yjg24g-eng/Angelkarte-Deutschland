// Nächster Pegel zum gewählten Ort. Es wird keine Position übertragen: Stationslisten werden ganz geladen,
// pro Gerät zwischengespeichert und auf dem Gerät durchsucht.
// - Bundeswasserstraßen (PEGELONLINE): live, höchstens alle 30 min neu, danach 24-h-Reihe des einen Pegels.
// - Landespegel NRW (OpenHygon): Tagesdatei, nur wenn der Ort in NRW oder an seiner Grenze liegt; höchstens alle 6 h.
import { useEffect, useState } from 'react';
import { useProviders } from '../../ports/providersContext';
import {
  changeOver,
  GAUGE_RADIUS_KM,
  GaugeListSchema,
  nearestGauge,
  type GaugeList,
  type GaugeStation,
  type NearestGauge,
} from '../../domain/gauges';
import { useStateResolution } from '../law/useLawCheck';

const BUND = { key: 'fangpunkt.gauges', maxAgeMs: 30 * 60_000 };
const NRW = { key: 'fangpunkt.gaugesNrw', maxAgeMs: 6 * 3_600_000 };

function readCache(key: string): GaugeList | undefined {
  try {
    const r = GaugeListSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null'));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

interface ListState {
  data?: GaugeList | undefined;
  stale: boolean;
  error: boolean;
}

/** Stationsliste aus dem Zwischenspeicher, bei Bedarf neu laden (nur solange `enabled`). */
function useStationList(
  cfg: { key: string; maxAgeMs: number },
  load: () => Promise<GaugeStation[] | null>,
  enabled: boolean,
): ListState {
  const [list, setList] = useState<ListState>(() => ({
    data: readCache(cfg.key),
    stale: false,
    error: false,
  }));
  useEffect(() => {
    if (!enabled) return;
    const cached = readCache(cfg.key);
    if (cached && Date.now() - cached.fetchedAt < cfg.maxAgeMs) return;
    let alive = true;
    load()
      .then((stations) => {
        if (!alive) return;
        if (!stations) throw new Error('unbrauchbare Antwort');
        const data = { fetchedAt: Date.now(), stations };
        try {
          localStorage.setItem(cfg.key, JSON.stringify(data));
        } catch {
          // nur Komfort
        }
        setList({ data, stale: false, error: false });
      })
      .catch(() => alive && setList((l) => ({ ...l, stale: !!l.data, error: !l.data })));
    return () => {
      alive = false;
    };
  }, [cfg, load, enabled]);
  return list;
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
  const { gauges, gaugesNrw } = useProviders();
  const region = useStateResolution(pos);
  const inNrw =
    region?.kind === 'state'
      ? region.code === 'NW'
      : region?.kind === 'border' && region.codes.includes('NW');
  const bund = useStationList(BUND, gauges.stations, true);
  const nrw = useStationList(NRW, gaugesNrw.stations, !!inNrw);
  const [change, setChange] = useState<{ uuid: string; v?: number | undefined }>();

  const lat = pos?.lat;
  const lng = pos?.lng;
  const stations = [...(bund.data?.stations ?? []), ...(inNrw ? (nrw.data?.stations ?? []) : [])];
  const nearest =
    stations.length && lat !== undefined && lng !== undefined
      ? nearestGauge(stations, { lat, lng })
      : undefined;
  const near = nearest && nearest.km <= GAUGE_RADIUS_KM ? nearest.station : undefined;
  // Bundespegel: 24-h-Reihe nachladen; Landespegel bringen die Änderung schon mit
  const uuid = near?.source === 'pegelonline' ? near.uuid : undefined;

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

  const lists = inNrw ? [bund, nrw] : [bund];
  if (lists.every((l) => l.error)) return { status: 'error' };
  // Warten, bis alle nötigen Listen da sind (oder fehlgeschlagen) – sonst springt der „nächste Pegel“
  if (lists.some((l) => !l.data && !l.error) || (pos && region === undefined)) return { status: 'loading' };
  const used = lists.filter((l) => l.data);
  return {
    status: 'ok',
    nearest,
    fetchedAt: Math.min(...used.map((l) => l.data?.fetchedAt ?? 0)),
    stale: used.some((l) => l.stale),
    change24h: near?.source === 'hygon' ? near.change24h : change?.uuid === uuid ? change?.v : undefined,
  };
}
