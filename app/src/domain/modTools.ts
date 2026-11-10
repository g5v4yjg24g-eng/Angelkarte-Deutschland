// Admin-Bereich → Verwaltung (Wunsch Nutzer 2026-11-10): Rollen, gesperrte Nutzernamen, Moderationsprotokoll,
// Statistiken. Zeilen vom Server prüfen und aufbereiten. Rein (ohne React, DB oder Netz).
import { z } from 'zod';

const opt = z.string().nullable().optional();
const u = (v: string | null | undefined) => v ?? undefined;

// Rollen ---------------------------------------------------------------------------------------------------
export type ModRole = 'founder' | 'moderator';
export interface ModRoleEntry {
  userId: string;
  username?: string | undefined;
  displayName?: string | undefined;
  role: ModRole;
  since: string;
}
const RoleRow = z.object({
  user_id: z.string(),
  username: opt,
  display_name: opt,
  role: z.enum(['founder', 'moderator']),
  since: z.string(),
});
export function parseModRoles(rows: readonly unknown[] | null | undefined): ModRoleEntry[] {
  const out: ModRoleEntry[] = [];
  for (const r of rows ?? []) {
    const p = RoleRow.safeParse(r);
    if (p.success)
      out.push({
        userId: p.data.user_id,
        username: u(p.data.username),
        displayName: u(p.data.display_name),
        role: p.data.role,
        since: p.data.since,
      });
  }
  return out;
}
export const parseModRole = (v: unknown): ModRole | undefined =>
  v === 'founder' || v === 'moderator' ? v : undefined;

// Gesperrte Nutzernamen -----------------------------------------------------------------------------------
export type BlockedNameKind = 'exact' | 'contains';
export interface BlockedName {
  pattern: string;
  kind: BlockedNameKind;
  note?: string | undefined;
  createdAt: string;
  moderatorName?: string | undefined;
  /** bestehende Konten, deren Name darauf passt (bleiben bestehen) */
  matches: number;
}
const BlockedRow = z.object({
  pattern: z.string(),
  kind: z.enum(['exact', 'contains']),
  note: opt,
  created_at: z.string(),
  moderator_name: opt,
  matches: z.number().int().min(0).nullable().optional(),
});
export function parseBlockedNames(rows: readonly unknown[] | null | undefined): BlockedName[] {
  const out: BlockedName[] = [];
  for (const r of rows ?? []) {
    const p = BlockedRow.safeParse(r);
    if (p.success)
      out.push({
        pattern: p.data.pattern,
        kind: p.data.kind,
        note: u(p.data.note),
        createdAt: p.data.created_at,
        moderatorName: u(p.data.moderator_name),
        matches: p.data.matches ?? 0,
      });
  }
  return out;
}

/** Schlüssel wie auf dem Server (username_key): klein, ohne Leerraum, ohne „.“ und „_“ */
export const usernameKey = (s: string) => s.trim().toLowerCase().replace(/[._]/g, '');

/** Prüft ein Sperrwort; liefert den gespeicherten Schlüssel oder einen Fehler */
export function blockedPatternIssue(s: string): 'short' | 'long' | 'chars' | undefined {
  const k = usernameKey(s);
  if (k.length < 2) return 'short';
  if (k.length > 30) return 'long';
  if (!/^[a-z0-9]+$/.test(k)) return 'chars';
  return undefined;
}

/** Passt ein Nutzername auf ein Sperrwort? (gleiche Regel wie username_blocked auf dem Server) */
export function nameMatches(username: string, b: Pick<BlockedName, 'pattern' | 'kind'>): boolean {
  const k = usernameKey(username);
  return b.kind === 'exact' ? k === b.pattern : k.includes(b.pattern);
}

// Moderationsprotokoll ------------------------------------------------------------------------------------
export interface ModLogItem {
  id: string;
  action: string;
  detail?: string | undefined;
  createdAt: string;
  moderatorName?: string | undefined;
  targetUserId?: string | undefined;
  targetName?: string | undefined;
  targetUsername?: string | undefined;
  reportId?: string | undefined;
}
/** Seitengröße von mod_log_list */
export const LOG_PAGE = 100;
const LogRow = z.object({
  id: z.string(),
  action: z.string(),
  detail: opt,
  created_at: z.string(),
  moderator_name: opt,
  target_user: opt,
  target_name: opt,
  target_username: opt,
  report_id: opt,
});
export function parseModLogItems(rows: readonly unknown[] | null | undefined): ModLogItem[] {
  const out: ModLogItem[] = [];
  for (const r of rows ?? []) {
    const p = LogRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      action: d.action,
      detail: u(d.detail),
      createdAt: d.created_at,
      moderatorName: u(d.moderator_name),
      targetUserId: u(d.target_user),
      targetName: u(d.target_name),
      targetUsername: u(d.target_username),
      reportId: u(d.report_id),
    });
  }
  return out;
}

/** Aktionen, nach denen das Protokoll gefiltert werden kann (Reihenfolge der Auswahl) */
export const LOG_ACTIONS = [
  'warn',
  'revoke_warning',
  'ban',
  'unban',
  'hide_post',
  'restore_post',
  'delete_post',
  'delete_comment',
  'delete_spot',
  'delete_avatar',
  'clear_profile',
  'resolve',
  'in_progress',
  'reopen',
  'view_reporter',
  'search_email',
  'block_name',
  'unblock_name',
  'publish_rules',
] as const;

// Statistiken -----------------------------------------------------------------------------------------------
export const STATS_PERIODS = [7, 30, 90, 365] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export interface ModStats {
  days: number;
  reports: number;
  reportsDone: number;
  byReason: Record<string, number>;
  byKind: Record<string, number>;
  /** Median Meldung → erledigt in Stunden; undefined, solange nichts erledigt ist */
  medianHours?: number | undefined;
  actions: Record<string, number>;
  newUsers: number;
  bannedNow: number;
  warnedNow: number;
  weeks: { week: string; reports: number; newUsers: number }[];
}
const count = z.number().int().min(0);
const StatsJson = z.object({
  days: z.number().int(),
  reports: count,
  reports_done: count,
  by_reason: z.record(z.string(), count),
  by_kind: z.record(z.string(), count),
  median_hours: z.number().min(0).nullable().optional(),
  actions: z.record(z.string(), count),
  new_users: count,
  banned_now: count,
  warned_now: count,
  weeks: z.array(z.object({ week: z.string(), reports: count, new_users: count })),
});
export function parseModStats(v: unknown): ModStats | undefined {
  const p = StatsJson.safeParse(v);
  if (!p.success) return undefined;
  const d = p.data;
  return {
    days: d.days,
    reports: d.reports,
    reportsDone: d.reports_done,
    byReason: d.by_reason,
    byKind: d.by_kind,
    medianHours: d.median_hours ?? undefined,
    actions: d.actions,
    newUsers: d.new_users,
    bannedNow: d.banned_now,
    warnedNow: d.warned_now,
    weeks: d.weeks.map((w) => ({ week: w.week, reports: w.reports, newUsers: w.new_users })),
  };
}

export interface Bar {
  key: string;
  value: number;
  /** Anteil am größten Wert, 0–1 (für die Balkenlänge) */
  share: number;
}
/** Zahlen als Balken: größte zuerst, gleich große nach Schlüssel; leere Liste bei nichts */
export function toBars(values: Record<string, number>): Bar[] {
  const entries = Object.entries(values).filter(([, v]) => v > 0);
  const max = Math.max(0, ...entries.map(([, v]) => v));
  return entries
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([key, value]) => ({ key, value, share: max ? value / max : 0 }));
}

/** Summe der Eingriffe (Löschen, Ausblenden, Verwarnen, Sperren) aus den Aktionen */
export function interventions(actions: Record<string, number>): number {
  return [
    'delete_post',
    'delete_comment',
    'delete_spot',
    'delete_avatar',
    'clear_profile',
    'hide_post',
    'warn',
    'ban',
  ]
    .map((a) => actions[a] ?? 0)
    .reduce((s, n) => s + n, 0);
}
