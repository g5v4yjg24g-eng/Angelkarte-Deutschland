// Einsprüche gegen Sperren (Entscheidung Nutzer 2026-11-10: Link in der Sperr-Mail). Rein (ohne React, DB oder Netz).
// Grenzen wie auf dem Server (*_appeals.sql): Begründung 10–2000 Zeichen, Schlüssel aus der Mail 64 Hex-Zeichen.
import { z } from 'zod';

export const APPEAL_MIN = 10;
export const APPEAL_MAX = 2000;

/** Schlüssel aus der Adresse (?t=…); alles andere gilt als ungültig, ohne den Server zu fragen */
export function appealToken(search: string): string | undefined {
  const t = new URLSearchParams(search).get('t')?.trim() ?? '';
  return /^[0-9a-f]{64}$/.test(t) ? t : undefined;
}

export type AppealState = 'open' | 'used' | 'ended' | 'invalid';
export interface AppealInfo {
  state: AppealState;
  banUntil?: string | undefined;
  banReason?: string | undefined;
  appealStatus?: AppealStatus | undefined;
}
export type AppealStatus = 'open' | 'accepted' | 'rejected';

const opt = z.string().nullable().optional();
const InfoRow = z.object({
  state: z.enum(['open', 'used', 'ended', 'invalid']),
  ban_until: opt,
  ban_reason: opt,
  appeal_status: z.enum(['open', 'accepted', 'rejected']).nullable().optional(),
});
export function parseAppealInfo(rows: readonly unknown[] | null | undefined): AppealInfo {
  const p = InfoRow.safeParse(rows?.[0]);
  if (!p.success) return { state: 'invalid' };
  return {
    state: p.data.state,
    banUntil: p.data.ban_until ?? undefined,
    banReason: p.data.ban_reason ?? undefined,
    appealStatus: p.data.appeal_status ?? undefined,
  };
}

export function appealBodyIssue(body: string): 'short' | 'long' | undefined {
  const n = body.trim().length;
  if (n < APPEAL_MIN) return 'short';
  if (n > APPEAL_MAX) return 'long';
  return undefined;
}

export interface ModAppeal {
  id: string;
  userId: string;
  username?: string | undefined;
  displayName?: string | undefined;
  body: string;
  status: AppealStatus;
  createdAt: string;
  decidedAt?: string | undefined;
  decidedByName?: string | undefined;
  decisionNote?: string | undefined;
  banned: boolean;
  banUntil?: string | undefined;
  banReason?: string | undefined;
}
const ModRow = z.object({
  id: z.string(),
  user_id: z.string(),
  username: opt,
  display_name: opt,
  body: z.string(),
  status: z.enum(['open', 'accepted', 'rejected']),
  created_at: z.string(),
  decided_at: opt,
  decided_by_name: opt,
  decision_note: opt,
  banned: z.boolean().nullable().optional(),
  ban_until: opt,
  ban_reason: opt,
});
const u = (v: string | null | undefined) => v ?? undefined;
export function parseModAppeals(rows: readonly unknown[] | null | undefined): ModAppeal[] {
  const out: ModAppeal[] = [];
  for (const r of rows ?? []) {
    const p = ModRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      userId: d.user_id,
      username: u(d.username),
      displayName: u(d.display_name),
      body: d.body,
      status: d.status,
      createdAt: d.created_at,
      decidedAt: u(d.decided_at),
      decidedByName: u(d.decided_by_name),
      decisionNote: u(d.decision_note),
      banned: d.banned ?? false,
      banUntil: u(d.ban_until),
      banReason: u(d.ban_reason),
    });
  }
  return out;
}

export function appealErrorKind(
  e: { message?: string } | undefined,
): 'invalid' | 'used' | 'ended' | 'short' | 'long' | 'offline' | 'unknown' {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('invalid_token')) return 'invalid';
  if (m.includes('already_used')) return 'used';
  if (m.includes('not_banned')) return 'ended';
  if (m.includes('too_short')) return 'short';
  if (m.includes('too_long')) return 'long';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
