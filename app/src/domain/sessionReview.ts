// Session-Rückblick (Wunsch Nutzer 2026-10-23): Kennzahlen, Fang-Highlights und Höhepunkte aus den gespeicherten
// Einträgen und der Route. Nichts wird geschätzt: Länge/Gewicht nur aus erfassten Werten, Rekorde nur, wenn es
// genug frühere Werte derselben Art zum Vergleich gibt. Ereignisse sind die Fangbuch-Einträge der Session.
import type { Catch, CatchOutcome, LatLng, Session, Track } from './schemas';
import { activeMs, durationMs, sessionCatches } from './session';
import { trackDistanceM } from './track';

/** Ab so vielen früheren Werten derselben Art gilt ein Vergleich als belastbar [A] */
export const RECORD_MIN_HISTORY = 3;
/** Mehrere Fänge in so kurzer Zeit = „Doppelschlag“ [A] */
export const BURST_WINDOW_MS = 30 * 60_000;
/** Ab dieser Dauer „lange Session“ [A] */
export const LONG_SESSION_MS = 6 * 3_600_000;
/** Ab so vielen Bissen (Fang, Kontakt, Fehlbiss) „viele Kontakte“ [A] */
export const MANY_BITES = 10;

export interface ReviewEvent {
  id: string;
  outcome: CatchOutcome;
  at: number;
  position?: LatLng | undefined;
  item: Catch;
}

/** Einträge der Session als Ereignisse, zeitlich sortiert (gleiche Quelle für Karte und Timeline). */
export function reviewEvents(session: Session, catches: readonly Catch[]): ReviewEvent[] {
  return sessionCatches(session, catches).map(({ item }) => ({
    id: item.id,
    outcome: item.outcome,
    at: Date.parse(item.at),
    position: item.position ? { lat: item.position.lat, lng: item.position.lng } : undefined,
    item,
  }));
}

export interface CatchHighlight {
  item: Catch;
  /** Wert ist geschätzt (nicht gemessen/gewogen) */
  estimated: boolean;
}

export type Moment =
  | { kind: 'burst'; count: number; minutes: number }
  | { kind: 'long'; ms: number }
  | { kind: 'manyBites'; count: number }
  | { kind: 'recordLength'; item: Catch; previousBestCm: number }
  | { kind: 'recordWeight'; item: Catch; previousBestG: number };

export interface Review {
  durationMs: number;
  activeMs: number;
  /** Strecke entlang der Route (m); undefined ohne Route */
  distanceM?: number | undefined;
  /** Abschnitte der Route (> 1 = Aufzeichnung unterbrochen) */
  segments: number;
  events: number;
  counts: Record<CatchOutcome, number>;
  /** Bisse wie in der Statistik: Fang + Kontakt + Fehlbiss */
  bites: number;
  longest?: CatchHighlight | undefined;
  heaviest?: CatchHighlight | undefined;
  speciesCount: number;
  /** häufigste Art, nur bei eindeutigem Spitzenreiter mit mindestens 2 Fängen */
  topSpecies?: { speciesId: string; count: number } | undefined;
  firstCatch?: Catch | undefined;
  lastCatch?: Catch | undefined;
  moments: Moment[];
}

const caughtOf = (events: readonly ReviewEvent[]) => events.filter((e) => e.outcome === 'caught');

function maxBy(items: readonly Catch[], key: (c: Catch) => number | undefined): Catch | undefined {
  let best: Catch | undefined;
  for (const c of items) {
    const v = key(c);
    if (v !== undefined && (best === undefined || v > (key(best) ?? -Infinity))) best = c;
  }
  return best;
}

/** Größte Zahl von Fängen innerhalb von BURST_WINDOW_MS und die Minuten zwischen dem ersten und letzten davon. */
function burst(times: readonly number[]): { count: number; minutes: number } {
  let best = { count: 0, minutes: 0 };
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while ((times[i] as number) - (times[j] as number) > BURST_WINDOW_MS) j++;
    const count = i - j + 1;
    if (count > best.count)
      best = { count, minutes: Math.round(((times[i] as number) - (times[j] as number)) / 60_000) };
  }
  return best;
}

/**
 * Persönliche Rekorde je Art: der größte Wert der Session übertrifft alle früheren Werte derselben Art, und es gab
 * mindestens RECORD_MIN_HISTORY frühere Werte. Nur gelandete Fische aus anderen Sessions bzw. ohne Session, die vor
 * dem Beginn dieser Session liegen.
 */
function records(
  session: Session,
  caught: readonly Catch[],
  all: readonly Catch[],
  key: (c: Catch) => number | undefined,
): { item: Catch; previousBest: number }[] {
  const start = Date.parse(session.startAt);
  const bySpecies = new Map<string, Catch>();
  for (const c of caught) {
    const v = key(c);
    if (!c.speciesId || v === undefined) continue;
    const cur = bySpecies.get(c.speciesId);
    if (!cur || v > (key(cur) ?? -Infinity)) bySpecies.set(c.speciesId, c);
  }
  const out: { item: Catch; previousBest: number }[] = [];
  for (const [speciesId, item] of bySpecies) {
    const earlier = all
      .filter(
        (c) =>
          !c.deletedAt &&
          c.outcome === 'caught' &&
          c.speciesId === speciesId &&
          c.sessionId !== session.id &&
          Date.parse(c.at) < start,
      )
      .map(key)
      .filter((v): v is number => v !== undefined);
    if (earlier.length < RECORD_MIN_HISTORY) continue;
    const previousBest = Math.max(...earlier);
    if ((key(item) ?? 0) > previousBest) out.push({ item, previousBest });
  }
  return out;
}

export function buildReview(
  session: Session,
  sessionEvents: readonly ReviewEvent[],
  track: Pick<Track, 'segments'> | undefined,
  allCatches: readonly Catch[],
  nowMs: number,
): Review {
  const counts: Record<CatchOutcome, number> = { caught: 0, contact: 0, missed_bite: 0, observation: 0 };
  for (const e of sessionEvents) counts[e.outcome]++;
  const caught = caughtOf(sessionEvents).map((e) => e.item);

  const longest = maxBy(caught, (c) => c.lengthCm);
  const heaviest = maxBy(caught, (c) => c.weightG);
  const speciesCounts = new Map<string, number>();
  for (const c of caught)
    if (c.speciesId) speciesCounts.set(c.speciesId, (speciesCounts.get(c.speciesId) ?? 0) + 1);
  const ranked = [...speciesCounts].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const topSpecies =
    top && top[1] >= 2 && (!second || second[1] < top[1]) ? { speciesId: top[0], count: top[1] } : undefined;

  const dur = durationMs(session, nowMs);
  const bites = counts.caught + counts.contact + counts.missed_bite;
  const moments: Moment[] = [];
  for (const r of records(session, caught, allCatches, (c) => c.lengthCm))
    moments.push({ kind: 'recordLength', item: r.item, previousBestCm: r.previousBest });
  for (const r of records(session, caught, allCatches, (c) => c.weightG))
    moments.push({ kind: 'recordWeight', item: r.item, previousBestG: r.previousBest });
  const b = burst(caught.map((c) => Date.parse(c.at)));
  if (b.count >= 2) moments.push({ kind: 'burst', count: b.count, minutes: b.minutes });
  if (bites >= MANY_BITES) moments.push({ kind: 'manyBites', count: bites });
  if (session.endAt && dur >= LONG_SESSION_MS) moments.push({ kind: 'long', ms: dur });

  return {
    durationMs: dur,
    activeMs: activeMs(session, nowMs),
    distanceM: track && track.segments.length ? trackDistanceM(track.segments) : undefined,
    segments: track?.segments.length ?? 0,
    events: sessionEvents.length,
    counts,
    bites,
    longest: longest && { item: longest, estimated: longest.lengthMethod !== 'measured' },
    heaviest: heaviest && { item: heaviest, estimated: heaviest.weightMethod !== 'weighed' },
    speciesCount: speciesCounts.size,
    topSpecies,
    firstCatch: caught[0],
    lastCatch: caught.length > 1 ? caught.at(-1) : undefined,
    moments,
  };
}

/** Name des Gewässers: an der Session, sonst der häufigste Name ihrer Einträge. */
export function sessionWaterName(session: Session, events: readonly ReviewEvent[]): string | undefined {
  const own = session.waterSnapshot?.customName ?? session.waterSnapshot?.name;
  if (own) return own;
  const counts = new Map<string, number>();
  for (const e of events) {
    const n = e.item.waterSnapshot?.customName ?? e.item.waterSnapshot?.name;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}
