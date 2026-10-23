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
  name: z.string(),
  water: z.string(),
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
    if (series.length) out.push({ uuid, name: titleCase(name), water: titleCase(water), lat, lng, series });
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
