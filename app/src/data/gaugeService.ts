// Pegel am Fang nachladen (Wunsch Nutzer 2026-10-23: „am Anfang speichern“): Wasserstand am nächsten Pegel zum
// Fangzeitpunkt. Keine Position verlässt das Gerät – Stationslisten werden ganz geladen und auf dem Gerät
// durchsucht, danach nur die Messreihe der einen Station (Bund) bzw. die NRW-Tagesdatei.
import {
  gaugeForCatch,
  gaugeSnapshot,
  GaugeSnapshotSchema,
  gaugeStillValid,
  needsGauge,
  type GaugeSnapshot,
  type GaugeStation,
  type Point,
} from '../domain/gauges';
import type { LatLng } from '../domain/schemas';
import type { GaugesProvider, NrwGaugesProvider } from '../ports/gauges';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export const GAUGE_BATCH = 20;
/** Messreihe vor und nach dem Fangzeitpunkt (für Wert und 24-h-Änderung) */
const BEFORE_MS = 25 * 3_600_000;
const AFTER_MS = 3_600_000;

export interface GaugeSources {
  gauges: GaugesProvider;
  gaugesNrw: NrwGaugesProvider;
  /** Liegt der Ort in NRW (oder an seiner Grenze)? Nur dann wird die NRW-Tagesdatei geladen. */
  inNrw: (pos: LatLng) => Promise<boolean>;
}

export interface GaugeRun {
  filled: string[];
  /** Messwert liegt noch nicht vor – in diesem Lauf nicht erneut fragen */
  later: string[];
  error?: unknown;
}

export async function pendingGaugeIds(db: FangpunktDB = getDb(), nowMs = Date.now()): Promise<string[]> {
  const rows = await db.catches.filter((c) => needsGauge(c, nowMs)).toArray();
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((c) => c.id);
}

export async function fillMissingGauges(
  src: GaugeSources,
  { skip = new Set<string>(), limit = GAUGE_BATCH, nowMs = Date.now() } = {},
  db: FangpunktDB = getDb(),
): Promise<GaugeRun> {
  const run: GaugeRun = { filled: [], later: [] };
  const ids = (await pendingGaugeIds(db, nowMs)).filter((id) => !skip.has(id)).slice(0, limit);
  if (!ids.length) return run;
  const nowIso = new Date(nowMs).toISOString();
  // Listen erst bei Bedarf und je Lauf nur einmal laden
  let bund: Promise<GaugeStation[]> | undefined;
  let nrw: Promise<{ stations: GaugeStation[]; series: Map<string, Point[]> }> | undefined;
  const bundList = () =>
    (bund ??= src.gauges.stations().then((s) => {
      if (!s) throw new Error('Pegel: unbrauchbare Stationsliste');
      return s;
    }));
  const nrwList = () =>
    (nrw ??= src.gaugesNrw.withSeries().then((r) => {
      if (!r) throw new Error('Landespegel: unbrauchbare Tagesdatei');
      return r;
    }));

  for (const id of ids) {
    const c = await db.catches.get(id);
    if (!c?.position || !needsGauge(c, nowMs)) continue;
    const atMs = Date.parse(c.at);
    let snap: GaugeSnapshot | 'later';
    try {
      const stations = [...(await bundList())];
      if (await src.inNrw(c.position)) stations.push(...(await nrwList()).stations);
      const near = gaugeForCatch(stations, c.position, atMs, nowMs);
      if (typeof near === 'string') snap = { status: 'none', reason: near, checkedAt: nowIso };
      else {
        const points =
          near.station.source === 'hygon'
            ? ((await nrwList()).series.get(near.station.uuid) ?? [])
            : await src.gauges.waterLevelBetween(
                near.station.uuid,
                atMs - BEFORE_MS,
                Math.min(nowMs, atMs + AFTER_MS),
              );
        snap = gaugeSnapshot(near, points, atMs, nowIso);
      }
    } catch (error) {
      run.error = error;
      break;
    }
    if (snap === 'later' || !GaugeSnapshotSchema.safeParse(snap).success) {
      run.later.push(id);
      continue;
    }
    const value = snap;
    // Nur speichern, wenn der Fang inzwischen nicht verschoben, gelöscht oder schon versorgt wurde.
    const saved = await db.transaction('rw', db.catches, async () => {
      const cur = await db.catches.get(id);
      if (!cur || !needsGauge(cur, nowMs) || !gaugeStillValid(c, cur)) return false;
      await repo('catches', db).update(id, { gauge: value });
      return true;
    });
    if (saved) run.filled.push(id);
  }
  return run;
}
