// Melden und Blockieren (Etappe 5) und die Regeln der Community. Rein, ohne Netz.
import { z } from 'zod';

/** Gründe – dieselben Werte prüft der Server (reports.reason) */
export const REPORT_REASONS = ['spam', 'abuse', 'nudity', 'violence', 'privacy', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = 'post' | 'spot' | 'user';

export interface ReportInput {
  kind: ReportTarget;
  /** ID des Beitrags/Spots bzw. bei `user` die Nutzer-ID */
  targetId: string;
  /** Konto, dem der Inhalt gehört */
  targetUserId: string;
  reason: ReportReason;
  details?: string | undefined;
}

export const REPORT_DETAILS_MAX = 1000;

export function reportInput(
  kind: ReportTarget,
  targetId: string,
  targetUserId: string,
  reason: ReportReason,
  details: string,
): ReportInput {
  const d = details.trim().slice(0, REPORT_DETAILS_MAX);
  return { kind, targetId, targetUserId, reason, ...(d ? { details: d } : {}) };
}

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string;
}

const BlockRowSchema = z.object({ user_id: z.string(), username: z.string(), display_name: z.string() });

export function parseBlockRows(rows: readonly unknown[] | null | undefined): BlockedUser[] {
  const out: BlockedUser[] = [];
  for (const r of rows ?? []) {
    const p = BlockRowSchema.safeParse(r);
    if (p.success)
      out.push({ userId: p.data.user_id, username: p.data.username, displayName: p.data.display_name });
  }
  return out;
}

/** Gemeldete Inhalte blendet die App für die meldende Person sofort aus (Schlüssel `<Art>:<ID>`). */
export const hiddenKey = (kind: ReportTarget, id: string) => `${kind}:${id}`;

export function parseHidden(raw: string | null): Set<string> {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Ausblenden: Inhalt selbst oder alles von einem gemeldeten Konto */
export function isHidden(
  hidden: ReadonlySet<string>,
  kind: ReportTarget,
  id: string,
  ownerId: string,
): boolean {
  return hidden.has(hiddenKey(kind, id)) || hidden.has(hiddenKey('user', ownerId));
}

/**
 * Regeln der Community: Zustimmung vor dem Versand des Anmeldecodes (Wunsch Nutzer 2026-11-03).
 * Ändern sich die Regeln, Version erhöhen – dann erscheint das Fenster erneut.
 */
export const RULES_VERSION = 1;

export function needsRulesConsent(stored: string | null): boolean {
  const n = Number(stored);
  return !(stored && Number.isFinite(n) && n >= RULES_VERSION);
}

export function moderationErrorKind(
  e: { message?: string; status?: number } | undefined,
): 'tooMany' | 'notSignedIn' | 'offline' | 'unknown' {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('too_many')) return 'tooMany';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
