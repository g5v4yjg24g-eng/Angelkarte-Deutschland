// Pop-up für Moderatoren bei neuen Meldungen (Wunsch Nutzer 2026-11-23): was gezeigt wird, entscheidet nur diese
// reine Logik. Zeigt nie Inhalt, meldende Person oder Ziel – nur Art und Grund (Datenschutz).
import { z } from 'zod';

/** Ab dieser Zeit gilt die älteste offene Meldung als überfällig (Bearbeitungsfrist 24 h, Wunsch Nutzer) */
export const OVERDUE_MS = 20 * 3_600_000;
/** „Später“ im Vollbild: so lange Ruhe */
export const SNOOZE_MS = 30 * 60_000;
/** Abstand der Abfragen, solange die App sichtbar ist */
export const ALERT_POLL_MS = 60_000;

export interface ModAlertSummary {
  openCount: number;
  oldestAt?: string | undefined;
  newestId?: string | undefined;
  newestAt?: string | undefined;
  newestType?: string | undefined;
  newestReason?: string | undefined;
}

const Row = z.object({
  open_count: z.number().int().min(0),
  oldest_at: z.string().nullable().optional(),
  newest_id: z.string().nullable().optional(),
  newest_at: z.string().nullable().optional(),
  newest_type: z.string().nullable().optional(),
  newest_reason: z.string().nullable().optional(),
});

/** Zeile von mod_alert_summary(); kaputt = undefined (dann wird nichts gezeigt) */
export function parseModAlertSummary(
  rows: readonly unknown[] | null | undefined,
): ModAlertSummary | undefined {
  const r = Row.safeParse(rows?.[0]);
  if (!r.success) return undefined;
  const d = r.data;
  return {
    openCount: d.open_count,
    oldestAt: d.oldest_at ?? undefined,
    newestId: d.newest_id ?? undefined,
    newestAt: d.newest_at ?? undefined,
    newestType: d.newest_type ?? undefined,
    newestReason: d.newest_reason ?? undefined,
  };
}

/** Was auf diesem Gerät schon gesehen oder zurückgestellt wurde (je Konto) */
export interface AlertState {
  seenNewestId?: string | undefined;
  snoozeUntil?: number | undefined;
}

export type AlertView = { kind: 'band' | 'full'; summary: ModAlertSummary } | undefined;

export function oldestAgeMs(s: ModAlertSummary, nowMs: number): number | undefined {
  const t = s.oldestAt ? Date.parse(s.oldestAt) : NaN;
  return Number.isFinite(t) ? Math.max(0, nowMs - t) : undefined;
}

/**
 * - keine offene Meldung: nichts
 * - älteste offene Meldung ≥ 20 h alt: Vollbild (außer zurückgestellt)
 * - sonst: Band, sobald es eine neuere Meldung gibt, die dieses Gerät noch nicht gezeigt hat
 */
export function decideAlert(s: ModAlertSummary | undefined, state: AlertState, nowMs: number): AlertView {
  if (!s || s.openCount <= 0) return undefined;
  if (state.snoozeUntil !== undefined && nowMs < state.snoozeUntil) return undefined;
  const age = oldestAgeMs(s, nowMs);
  if (age !== undefined && age >= OVERDUE_MS) return { kind: 'full', summary: s };
  if (s.newestId && s.newestId !== state.seenNewestId) return { kind: 'band', summary: s };
  return undefined;
}

/** „Später“ am Band: diese Meldung nicht noch einmal zeigen */
export const dismissBand = (s: ModAlertSummary, state: AlertState): AlertState => ({
  ...state,
  seenNewestId: s.newestId ?? state.seenNewestId,
});

/** „Später“ im Vollbild: 30 Minuten Ruhe, die neueste Meldung gilt dabei als gesehen */
export const snoozeFull = (s: ModAlertSummary, state: AlertState, nowMs: number): AlertState => ({
  ...dismissBand(s, state),
  snoozeUntil: nowMs + SNOOZE_MS,
});

/** Ganze Stunden, mindestens 1 – für „seit n Std. offen“ */
export const hoursOpen = (ageMs: number) => Math.max(1, Math.floor(ageMs / 3_600_000));

export function parseAlertState(raw: string | null): AlertState {
  try {
    const v = JSON.parse(raw ?? '{}') as AlertState;
    return {
      seenNewestId: typeof v.seenNewestId === 'string' ? v.seenNewestId : undefined,
      snoozeUntil: typeof v.snoozeUntil === 'number' ? v.snoozeUntil : undefined,
    };
  } catch {
    return {};
  }
}
