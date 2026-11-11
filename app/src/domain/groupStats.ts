// Rückblick gemeinsamer Sessions (Wunsch Nutzer 2026-11-11, Entscheidung „nur Kennzahlen teilen“): jede Person
// lädt nur Zahlen hoch – keine Route, keine Orte, keine Fotos. Hier: Form der Zahlen, Prüfung der Serverantwort und
// der Vergleich. Nichts wird geschätzt; fehlt eine Zahl, bleibt sie leer.
import { z } from 'zod';
import type { Review } from './sessionReview';

export interface GroupStats {
  caught: number;
  bites: number;
  entries: number;
  longestCm?: number | undefined;
  longestSpecies?: string | undefined;
  activeMs: number;
  distanceM?: number | undefined;
}

export type GroupStatsEntry = GroupStats & { userId: string };

const Row = z.object({
  user_id: z.string(),
  caught: z.number().int().min(0),
  bites: z.number().int().min(0),
  entries: z.number().int().min(0),
  longest_cm: z.number().nullable().optional(),
  longest_species: z.string().nullable().optional(),
  active_ms: z.number().min(0),
  distance_m: z.number().int().min(0).nullable().optional(),
});

/** Antwort von group_session_stats_list; kaputte Zeilen fallen weg */
export function parseGroupStats(rows: readonly unknown[] | null | undefined): GroupStatsEntry[] {
  return (rows ?? []).flatMap((r) => {
    const p = Row.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [
      {
        userId: d.user_id,
        caught: d.caught,
        bites: d.bites,
        entries: d.entries,
        longestCm: d.longest_cm ?? undefined,
        longestSpecies: d.longest_species ?? undefined,
        activeMs: d.active_ms,
        distanceM: d.distance_m ?? undefined,
      },
    ];
  });
}

/** Die eigenen Zahlen aus dem Rückblick – nur, was gespeichert ist (größter Fisch nur mit erfasster Länge). */
export function statsFromReview(r: Review): GroupStats {
  const cm = r.longest?.item.lengthCm;
  return {
    caught: r.counts.caught,
    bites: r.bites,
    entries: r.events,
    longestCm: cm !== undefined && cm > 0 && cm <= 400 ? cm : undefined,
    longestSpecies: cm !== undefined ? r.longest?.item.speciesId : undefined,
    activeMs: Math.max(0, Math.round(r.activeMs)),
    distanceM: r.distanceM === undefined ? undefined : Math.round(r.distanceM),
  };
}

/** Der Server-Aufruf: Namen wie in der Tabelle */
export function statsPayload(s: GroupStats): Record<string, number | string | null> {
  return {
    caught: s.caught,
    bites: s.bites,
    entries: s.entries,
    longest_cm: s.longestCm ?? null,
    longest_species: s.longestSpecies ?? null,
    active_ms: s.activeMs,
    distance_m: s.distanceM ?? null,
  };
}

export type Metric = 'longest' | 'caught' | 'bites' | 'time';

/** Wer bei einer Zahl vorn liegt; bei Gleichstand oder ohne Wert niemand (kein Gewinner erfunden). */
export function leaders(list: readonly GroupStatsEntry[]): Record<Metric, string | undefined> {
  const pick = (value: (s: GroupStatsEntry) => number | undefined): string | undefined => {
    let best: number | undefined;
    let who: string | undefined;
    let tie = false;
    for (const s of list) {
      const v = value(s);
      if (v === undefined || v <= 0) continue;
      if (best === undefined || v > best) {
        best = v;
        who = s.userId;
        tie = false;
      } else if (v === best) tie = true;
    }
    return tie ? undefined : who;
  };
  return {
    longest: pick((s) => s.longestCm),
    caught: pick((s) => s.caught),
    bites: pick((s) => s.bites),
    time: pick((s) => s.activeMs),
  };
}

export interface GroupTotals {
  entries: number;
  /** Summe der Strecken derer, die eine hatten; undefined, wenn niemand eine hatte */
  distanceM?: number | undefined;
}

export function groupTotals(list: readonly GroupStatsEntry[]): GroupTotals {
  const dist = list.map((s) => s.distanceM).filter((v): v is number => v !== undefined);
  return {
    entries: list.reduce((n, s) => n + s.entries, 0),
    distanceM: dist.length ? dist.reduce((a, b) => a + b, 0) : undefined,
  };
}
