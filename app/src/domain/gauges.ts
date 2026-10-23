// Pegel der Bundeswasserstraßen aus PEGELONLINE (Idee 1, Variante A, Freigabe Nutzer 2026-10-23).
// Rein: Stationsliste prüfen, nächsten Pegel finden, 24-h-Änderung. Felder laut REST-Doku
// [V: pegelonline.wsv.de/webservice/dokuRestapi, 2026-10-23]. Wasserstand W ist der Stand über dem
// Pegelnullpunkt, keine Wassertiefe.
import { z } from 'zod';
import { segmentDistanceM } from './geo';

/** Nur bis zu dieser Entfernung zeigt die App einen Pegel als „in der Nähe“ */
export const GAUGE_RADIUS_KM = 15;
export const GAUGE_KINDS = ['W', 'Q', 'WT'] as const;
export type GaugeKind = (typeof GAUGE_KINDS)[number];
/** Lage zu MNW/MHW laut PEGELONLINE (nur Wasserstand) */
export const GAUGE_STATES = ['low', 'normal', 'high', 'unknown', 'commented', 'out-dated'] as const;
export type GaugeState = (typeof GAUGE_STATES)[number];

const SeriesSchema = z.object({
  kind: z.enum(GAUGE_KINDS),
  unit: z.string().max(20),
  value: z.number().finite().optional(),
  at: z.string().optional(),
  state: z.enum(GAUGE_STATES).optional(),
});
export const GaugeStationSchema = z.object({
  uuid: z.string(),
  /** pegelonline = Bundeswasserstraßen (live), hygon = Landespegel NRW (Tagesdatei) */
  source: z.enum(['pegelonline', 'hygon']),
  name: z.string(),
  /** Gewässername; bei Landespegeln NRW nicht in den Daten → leer, dafür `area` */
  water: z.string(),
  /** Einzugsgebiet (Landespegel NRW) */
  area: z.string().optional(),
  /** Änderung des Wasserstands in 24 h, wenn schon in den Daten enthalten (Landespegel NRW) */
  change24h: z.number().optional(),
  lat: z.number(),
  lng: z.number(),
  series: z.array(SeriesSchema),
});
export type GaugeStation = z.infer<typeof GaugeStationSchema>;
export type GaugeSeries = z.infer<typeof SeriesSchema>;
export const GaugeListSchema = z.object({ fetchedAt: z.number(), stations: z.array(GaugeStationSchema) });
export type GaugeList = z.infer<typeof GaugeListSchema>;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** „DUISBURG-RUHRORT“ → „Duisburg-Ruhrort“ (PEGELONLINE liefert Großbuchstaben) */
export const titleCase = (s: string) =>
  s
    .toLocaleLowerCase('de-DE')
    .replace(/(^|[\s\-/(])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase('de-DE'));

/** stations.json?includeTimeseries=true&includeCurrentMeasurement=true → nur Stationen mit Koordinaten und W/Q/WT. */
export function parsePegelonlineStations(json: unknown): GaugeStation[] | null {
  if (!Array.isArray(json)) return null;
  const out: GaugeStation[] = [];
  for (const s of json as Record<string, unknown>[]) {
    const lat = num(s?.latitude);
    const lng = num(s?.longitude);
    const uuid = str(s?.uuid);
    const name = str(s?.longname) ?? str(s?.shortname);
    const water = str((s?.water as { longname?: unknown } | undefined)?.longname);
    if (lat === undefined || lng === undefined || !uuid || !name || !water) continue;
    const series: GaugeSeries[] = [];
    for (const t of (Array.isArray(s.timeseries) ? s.timeseries : []) as Record<string, unknown>[]) {
      const kind = t?.shortname;
      if (kind !== 'W' && kind !== 'Q' && kind !== 'WT') continue;
      const m = t.currentMeasurement as Record<string, unknown> | undefined;
      const state = m?.stateMnwMhw;
      const r = SeriesSchema.safeParse({
        kind,
        unit: str(t.unit) ?? '',
        value: num(m?.value),
        at: str(m?.timestamp),
        state: GAUGE_STATES.includes(state as GaugeState) ? state : undefined,
      });
      if (r.success) series.push(r.data);
    }
    if (series.length)
      out.push({
        uuid,
        source: 'pegelonline',
        name: titleCase(name),
        water: titleCase(water),
        lat,
        lng,
        series,
      });
  }
  return out;
}

export interface NearestGauge {
  station: GaugeStation;
  km: number;
}

/** Nächster Pegel zu einem Ort (Luftlinie). */
export function nearestGauge(
  stations: readonly GaugeStation[],
  pos: { lat: number; lng: number },
): NearestGauge | undefined {
  let best: NearestGauge | undefined;
  for (const s of stations) {
    const km = segmentDistanceM(pos.lng, pos.lat, [s.lng, s.lat], [s.lng, s.lat]) / 1000;
    if (!best || km < best.km) best = { station: s, km };
  }
  return best;
}

export const seriesOf = (s: GaugeStation, kind: GaugeKind) => s.series.find((x) => x.kind === kind);

export interface Point {
  t: number;
  v: number;
}

/** measurements.json → Punkte, zeitlich sortiert. */
export function parseMeasurements(json: unknown): Point[] {
  if (!Array.isArray(json)) return [];
  return (json as { timestamp?: unknown; value?: unknown }[])
    .map((m) => ({ t: Date.parse(String(m?.timestamp)), v: num(m?.value) }))
    .filter((p): p is Point => Number.isFinite(p.t) && p.v !== undefined)
    .sort((a, b) => a.t - b.t);
}

/** Änderung zum Wert vor etwa `hours` Stunden (±1 h Toleranz); undefined ohne passende Werte. */
export function changeOver(points: readonly Point[], hours = 24): number | undefined {
  const last = points.at(-1);
  if (!last) return undefined;
  const target = last.t - hours * 3_600_000;
  let best: Point | undefined;
  for (const p of points) if (!best || Math.abs(p.t - target) < Math.abs(best.t - target)) best = p;
  if (!best || Math.abs(best.t - target) > 3_600_000) return undefined;
  return Math.round((last.v - best.v) * 10) / 10;
}

// ---- Landespegel NRW (OpenHygon, LANUK) ------------------------------------------------------------------
// Stationsliste OpenHygon-Pegel-Stationen_EPSG4326.txt und Messwerte der letzten 7 Tage (messwerte.txt aus
// OpenHygon-Pegel-aktuell_CSV.zip, einmal täglich gegen 3 Uhr erzeugt) [V: opengeodata.nrw.de …/hygon/,
// Abruf 2026-10-23]. Lizenz DL-DE->Zero-2.0. Kein Gewässername in den Daten – nur das Einzugsgebiet.

interface HygonStation {
  no: string;
  name: string;
  lat: number;
  lng: number;
  area?: string | undefined;
  mnw?: number | undefined;
  mhw?: number | undefined;
}

const dec = (s: string | undefined) => {
  const v = s === undefined || s.trim() === '' ? NaN : Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
};

/** Stationsliste (Semikolon, Kopfzeile mit Spaltennamen). */
export function parseHygonStations(text: string): HygonStation[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const head = (lines.shift() ?? '').split(';');
  const col = (n: string) => head.indexOf(n);
  const [iLat, iLng, iName, iNo, iArea, iMnw, iMhw] = [
    'station_latitude',
    'station_longitude',
    'station_name',
    'station_no',
    'catchment_name',
    'LANUV_MNW',
    'LANUV_MHW',
  ].map(col);
  if ([iLat, iLng, iName, iNo].some((i) => i === undefined || i < 0)) return [];
  const out: HygonStation[] = [];
  for (const l of lines) {
    const f = l.split(';');
    const lat = dec(f[iLat ?? -1]);
    const lng = dec(f[iLng ?? -1]);
    const no = f[iNo ?? -1]?.trim();
    const name = f[iName ?? -1]?.trim();
    if (lat === undefined || lng === undefined || !no || !name) continue;
    out.push({
      no,
      name: name.replace(/_/g, ' '),
      lat,
      lng,
      area: f[iArea ?? -1]?.trim() || undefined,
      mnw: dec(f[iMnw ?? -1]),
      mhw: dec(f[iMhw ?? -1]),
    });
  }
  return out;
}

/** Lage zu MNW/MHW wie bei PEGELONLINE: am oder unter MNW niedrig, am oder über MHW hoch. */
export function levelState(v: number, mnw?: number, mhw?: number): GaugeState {
  if (mnw === undefined || mhw === undefined) return 'unknown';
  return v <= mnw ? 'low' : v >= mhw ? 'high' : 'normal';
}

/** Messwerte (station_no;time;value(cm)) + Stationen → Stationen mit letztem Wert und 24-h-Änderung. */
export function summarizeHygon(stations: readonly HygonStation[], measurements: string): GaugeStation[] {
  const wanted = new Map(stations.map((s) => [s.no, [] as Point[]]));
  let start = measurements.indexOf('\n') + 1;
  while (start > 0 && start < measurements.length) {
    let end = measurements.indexOf('\n', start);
    if (end < 0) end = measurements.length;
    const line = measurements.slice(start, end);
    start = end + 1;
    const a = line.indexOf(';');
    const b = line.indexOf(';', a + 1);
    if (a < 0 || b < 0) continue;
    const pts = wanted.get(line.slice(0, a));
    if (!pts) continue;
    const t = Date.parse(line.slice(a + 1, b));
    const v = dec(line.slice(b + 1));
    if (Number.isFinite(t) && v !== undefined) pts.push({ t, v });
  }
  const out: GaugeStation[] = [];
  for (const s of stations) {
    const pts = (wanted.get(s.no) ?? []).sort((x, y) => x.t - y.t);
    const last = pts.at(-1);
    if (!last) continue;
    const change = changeOver(pts);
    out.push({
      uuid: `hygon:${s.no}`,
      source: 'hygon',
      name: s.name,
      water: '',
      ...(s.area ? { area: s.area } : {}),
      ...(change !== undefined ? { change24h: change } : {}),
      lat: s.lat,
      lng: s.lng,
      series: [
        {
          kind: 'W',
          unit: 'cm',
          value: last.v,
          at: new Date(last.t).toISOString(),
          state: levelState(last.v, s.mnw, s.mhw),
        },
      ],
    });
  }
  return out;
}
