// Moderationsbereich (MODERATION_PLAN.md, Variante A): Zeilen vom Server lesen, Sperrdauer, Restzeit. Rein.
import { z } from 'zod';

export type ModKind = 'post' | 'comment' | 'spot' | 'user';

export interface ModReport {
  id: string;
  kind: ModKind;
  targetId: string;
  reason: string;
  details?: string | undefined;
  status: ModReportStatus;
  createdAt: string;
  /** nur aus der alten Liste (mod_reports); die neue liefert die meldende Person nur auf Anfrage */
  reporterId?: string | undefined;
  reporterName?: string | undefined;
  targetUserId?: string | undefined;
  targetName?: string | undefined;
  targetUsername?: string | undefined;
  targetBanned: boolean;
  openAgainst: number;
  /** Meldungen zum selben Inhalt (mit dieser) */
  sameTarget?: number | undefined;
  handledAt?: string | undefined;
  handledByName?: string | undefined;
  /** gemeldeter Beitrag ist ausgeblendet */
  targetHidden?: boolean | undefined;
}

export type ModReportStatus = 'open' | 'in_progress' | 'done';
export const REPORT_STATUSES: readonly ModReportStatus[] = ['open', 'in_progress', 'done'];

export interface ModContent {
  authorId: string;
  body?: string | undefined;
  photoPaths: string[];
  postId?: string | undefined;
  /** Beitragstext beim Kommentar, Name beim Spot, Sichtbarkeit beim Beitrag */
  extra?: string | undefined;
  createdAt: string;
}

export interface ModUser {
  userId: string;
  username: string;
  displayName: string;
  banned: boolean;
  banUntil?: string | undefined;
  banReason?: string | undefined;
  posts: number;
  comments: number;
  spots: number;
  reportsAgainst: number;
  joined: string;
}

export interface ModUserItem {
  kind: 'post' | 'comment' | 'spot';
  id: string;
  body?: string | undefined;
  photoPaths: string[];
  postId?: string | undefined;
  createdAt: string;
}

export interface ModLogEntry {
  action: string;
  detail?: string | undefined;
  createdAt: string;
  moderatorName?: string | undefined;
}

const opt = z.string().nullable().optional();
const ReportRow = z.object({
  id: z.string(),
  target_type: z.enum(['post', 'comment', 'spot', 'user']),
  target_id: z.string(),
  reason: z.string(),
  details: opt,
  status: z.enum(['open', 'in_progress', 'done']),
  created_at: z.string(),
  reporter: opt,
  reporter_name: opt,
  target_user: opt,
  target_name: opt,
  target_username: opt,
  target_banned: z.boolean().nullable().optional(),
  open_against: z.number().int().nullable().optional(),
  same_target: z.number().int().nullable().optional(),
  handled_at: opt,
  handled_by_name: opt,
  target_hidden: z.boolean().nullable().optional(),
});
const u = (v: string | null | undefined) => v ?? undefined;

export function parseModReports(rows: readonly unknown[] | null | undefined): ModReport[] {
  const out: ModReport[] = [];
  for (const r of rows ?? []) {
    const p = ReportRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      kind: d.target_type,
      targetId: d.target_id,
      reason: d.reason,
      details: u(d.details),
      status: d.status,
      createdAt: d.created_at,
      reporterId: u(d.reporter),
      reporterName: u(d.reporter_name),
      targetUserId: u(d.target_user),
      targetName: u(d.target_name),
      targetUsername: u(d.target_username),
      targetBanned: d.target_banned ?? false,
      openAgainst: d.open_against ?? 0,
      ...(d.same_target != null ? { sameTarget: d.same_target } : {}),
      ...(d.handled_at ? { handledAt: d.handled_at } : {}),
      ...(d.handled_by_name ? { handledByName: d.handled_by_name } : {}),
      ...(d.target_hidden != null ? { targetHidden: d.target_hidden } : {}),
    });
  }
  return out;
}

const ContentRow = z.object({
  author: z.string(),
  body: opt,
  photo_paths: z.array(z.string()).nullable().optional(),
  post_id: opt,
  extra: opt,
  created_at: z.string(),
});

/** Inhalt hinter einer Meldung; undefined = nicht mehr vorhanden */
export function parseModContent(rows: readonly unknown[] | null | undefined): ModContent | undefined {
  const p = ContentRow.safeParse(rows?.[0]);
  if (!p.success) return undefined;
  const d = p.data;
  return {
    authorId: d.author,
    body: u(d.body),
    photoPaths: d.photo_paths ?? [],
    postId: u(d.post_id),
    extra: u(d.extra),
    createdAt: d.created_at,
  };
}

const UserRow = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  banned: z.boolean(),
  ban_until: opt,
  ban_reason: opt,
  posts: z.number().int(),
  comments: z.number().int(),
  spots: z.number().int(),
  reports_against: z.number().int(),
  joined: z.string(),
});

export function parseModUser(rows: readonly unknown[] | null | undefined): ModUser | undefined {
  const p = UserRow.safeParse(rows?.[0]);
  if (!p.success) return undefined;
  const d = p.data;
  return {
    userId: d.user_id,
    username: d.username,
    displayName: d.display_name,
    banned: d.banned,
    banUntil: u(d.ban_until),
    banReason: u(d.ban_reason),
    posts: d.posts,
    comments: d.comments,
    spots: d.spots,
    reportsAgainst: d.reports_against,
    joined: d.joined,
  };
}

const ItemRow = z.object({
  kind: z.enum(['post', 'comment', 'spot']),
  id: z.string(),
  body: opt,
  photo_paths: z.array(z.string()).nullable().optional(),
  post_id: opt,
  created_at: z.string(),
});

export function parseModUserItems(rows: readonly unknown[] | null | undefined): ModUserItem[] {
  const out: ModUserItem[] = [];
  for (const r of rows ?? []) {
    const p = ItemRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      kind: d.kind,
      id: d.id,
      body: u(d.body),
      photoPaths: d.photo_paths ?? [],
      postId: u(d.post_id),
      createdAt: d.created_at,
    });
  }
  return out;
}

const LogRow = z.object({ action: z.string(), detail: opt, created_at: z.string(), moderator_name: opt });

export function parseModLog(rows: readonly unknown[] | null | undefined): ModLogEntry[] {
  const out: ModLogEntry[] = [];
  for (const r of rows ?? []) {
    const p = LogRow.safeParse(r);
    if (p.success)
      out.push({
        action: p.data.action,
        detail: u(p.data.detail),
        createdAt: p.data.created_at,
        moderatorName: u(p.data.moderator_name),
      });
  }
  return out;
}

/** Sperrdauer in Tagen; null = dauerhaft (Entscheidung Nutzer 2026-11-04) */
export const BAN_DURATIONS = [1, 7, 30, null] as const;
export type BanDuration = (typeof BAN_DURATIONS)[number];

/** Restzeit einer Sperre in ganzen Tagen/Stunden; undefined = dauerhaft, 0 = abgelaufen */
export function banRemaining(
  until: string | undefined,
  now = Date.now(),
): { days: number; hours: number } | undefined {
  if (!until) return undefined;
  const ms = Math.max(0, Date.parse(until) - now);
  const hours = Math.ceil(ms / 3_600_000);
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

export function modErrorKind(
  e: { message?: string; status?: number } | undefined,
):
  | 'notModerator'
  | 'self'
  | 'notFound'
  | 'noReason'
  | 'tooMany'
  | 'reauth'
  | 'emailNotAllowed'
  | 'exists'
  | 'notSignedIn'
  | 'offline'
  | 'unknown' {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_moderator')) return 'notModerator';
  if (m.includes('too_many_actions')) return 'tooMany';
  if (m.includes('reauth_required')) return 'reauth';
  if (m.includes('email_not_allowed')) return 'emailNotAllowed';
  if (/\bexists\b/.test(m)) return 'exists';
  if (m.includes('self')) return 'self';
  if (m.includes('not_found') || m.includes('not_banned')) return 'notFound';
  if (m.includes('no_reason')) return 'noReason';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}

// ---------------------------------------------------------------------------------------------------------
// Admin-Bereich, Phase 1 (Wunsch Nutzer 2026-11-10): Kennzahlen der Übersicht, Priorität, Nutzer aus Meldungen.

/** Kennzahlen der Übersicht; fehlt ein Wert, gibt es ihn (noch) nicht – angezeigt wird dann „–“, nie eine Schätzung */
export interface ModOverview {
  openReports: number;
  /** Meldungen im Stand „in Bearbeitung“ */
  inProgress?: number | undefined;
  /** heute (Europe/Berlin) erledigte Meldungen */
  doneToday?: number | undefined;
  bannedNow?: number | undefined;
  /** neue Profile der letzten 7 Tage */
  newUsers7d?: number | undefined;
  /** Einsprüche folgen in Phase 5 */
  openAppeals?: number | undefined;
}

const OverviewRow = z.object({
  open_reports: z.number().int().min(0),
  in_progress: z.number().int().min(0).nullable().optional(),
  done_today: z.number().int().min(0).nullable().optional(),
  banned_now: z.number().int().min(0).nullable().optional(),
  new_users_7d: z.number().int().min(0).nullable().optional(),
});

/** Zeile von mod_overview(); kaputt oder leer = undefined (dann zählt die App nur, was sie selbst sicher weiß) */
export function parseModOverview(rows: readonly unknown[] | null | undefined): ModOverview | undefined {
  const r = OverviewRow.safeParse(rows?.[0]);
  if (!r.success) return undefined;
  return {
    openReports: r.data.open_reports,
    inProgress: r.data.in_progress ?? undefined,
    doneToday: r.data.done_today ?? undefined,
    bannedNow: r.data.banned_now ?? undefined,
    newUsers7d: r.data.new_users_7d ?? undefined,
  };
}

export type ModPriority = 'high' | 'mid' | 'low';
/** Schwere Gründe bzw. mehrere offene Meldungen gegen dieselbe Person */
const SEVERE = new Set(['abuse', 'violence', 'nudity']);

/**
 * Priorität nur als Hinweis für die Reihenfolge des Ansehens – es wird nie automatisch gehandelt
 * (keine Sperre wegen vieler Meldungen, Wunsch Nutzer 2026-11-10).
 */
export function reportPriority(r: Pick<ModReport, 'reason' | 'openAgainst' | 'status'>): ModPriority {
  if (r.status === 'done') return 'low';
  if (SEVERE.has(r.reason) || r.openAgainst >= 3) return 'high';
  if (r.reason === 'privacy' || r.openAgainst >= 2) return 'mid';
  return 'low';
}

export interface ReportedUser {
  userId: string;
  name?: string | undefined;
  username?: string | undefined;
  banned: boolean;
  reports: number;
  open: number;
  last: string;
}

/** Gemeldete Konten aus der Meldungsliste: je Person zusammengefasst, offene zuerst, dann neueste */
export function reportedUsers(reports: readonly ModReport[]): ReportedUser[] {
  const by = new Map<string, ReportedUser>();
  for (const r of reports) {
    if (!r.targetUserId) continue;
    const cur = by.get(r.targetUserId) ?? {
      userId: r.targetUserId,
      name: r.targetName,
      username: r.targetUsername,
      banned: r.targetBanned,
      reports: 0,
      open: 0,
      last: r.createdAt,
    };
    cur.reports++;
    if (r.status !== 'done') cur.open++;
    if (r.createdAt > cur.last) cur.last = r.createdAt;
    by.set(r.targetUserId, cur);
  }
  return [...by.values()].sort((a, b) => b.open - a.open || b.last.localeCompare(a.last));
}

// ---------------------------------------------------------------------------------------------------------
// Meldungsverwaltung (Wunsch Nutzer 2026-11-10): Filter, Stand eines Beitrags, Verlauf.

export interface ReportFilter {
  kind?: ModKind | undefined;
  reason?: string | undefined;
}
/** Nach Art und Grund filtern (Stand filtert schon der Server); Reihenfolge bleibt (neueste zuerst) */
export function filterReports(list: readonly ModReport[], f: ReportFilter): ModReport[] {
  return list.filter((r) => (!f.kind || r.kind === f.kind) && (!f.reason || r.reason === f.reason));
}

export interface ModPostState {
  hiddenAt?: string | undefined;
  hiddenReason?: string | undefined;
}
const PostStateRow = z.object({ hidden_at: opt, hidden_reason: opt });
/** Stand eines Beitrags; undefined = Beitrag gibt es nicht (mehr) */
export function parseModPostState(rows: readonly unknown[] | null | undefined): ModPostState | undefined {
  const p = PostStateRow.safeParse(rows?.[0]);
  if (!p.success) return undefined;
  return {
    ...(p.data.hidden_at ? { hiddenAt: p.data.hidden_at } : {}),
    ...(p.data.hidden_reason ? { hiddenReason: p.data.hidden_reason } : {}),
  };
}

export interface ModReporter {
  displayName?: string | undefined;
  username?: string | undefined;
}
const ReporterRow = z.object({ display_name: opt, username: opt });
export function parseModReporter(rows: readonly unknown[] | null | undefined): ModReporter | undefined {
  const p = ReporterRow.safeParse(rows?.[0]);
  if (!p.success) return undefined;
  return { displayName: u(p.data.display_name), username: u(p.data.username) };
}

// ---------------------------------------------------------------------------------------------------------
// Nutzerverwaltung (Wunsch Nutzer 2026-11-10): Kontenliste, Suche, Verwarnungen.

export type ModUserFilter = 'all' | 'reported' | 'warned' | 'banned';
export const USER_FILTERS: readonly ModUserFilter[] = ['all', 'reported', 'warned', 'banned'];
/** Seitengröße von mod_users (Server liefert höchstens so viele) */
export const USER_PAGE = 50;

export interface ModUserRow {
  userId: string;
  username: string;
  displayName: string;
  joined: string;
  banned: boolean;
  banUntil?: string | undefined;
  reportsAgainst: number;
  openReports: number;
  activeWarnings: number;
}

const UserListRow = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  joined: z.string(),
  banned: z.boolean().nullable().optional(),
  ban_until: opt,
  reports_against: z.number().int().min(0).nullable().optional(),
  open_reports: z.number().int().min(0).nullable().optional(),
  active_warnings: z.number().int().min(0).nullable().optional(),
});

export function parseModUserRows(rows: readonly unknown[] | null | undefined): ModUserRow[] {
  const out: ModUserRow[] = [];
  for (const r of rows ?? []) {
    const p = UserListRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      userId: d.user_id,
      username: d.username,
      displayName: d.display_name,
      joined: d.joined,
      banned: d.banned ?? false,
      banUntil: u(d.ban_until),
      reportsAgainst: d.reports_against ?? 0,
      openReports: d.open_reports ?? 0,
      activeWarnings: d.active_warnings ?? 0,
    });
  }
  return out;
}

export type UserQueryKind = 'empty' | 'id' | 'email' | 'name';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+$/;
/** Wie der Server die Eingabe versteht (gleiche Regeln wie mod_users): Nutzer-ID, E-Mail (exakt) oder Namensteil */
export function userQueryKind(q: string): UserQueryKind {
  const t = q.trim();
  if (!t) return 'empty';
  if (UUID.test(t)) return 'id';
  if (EMAIL.test(t)) return 'email';
  return 'name';
}

export interface ModWarning {
  id: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | undefined;
  revokeNote?: string | undefined;
  reportId?: string | undefined;
  postId?: string | undefined;
  moderatorName?: string | undefined;
  active: boolean;
}

const WarningRow = z.object({
  id: z.string(),
  reason: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: opt,
  revoke_note: opt,
  report_id: opt,
  post_id: opt,
  moderator_name: opt,
  active: z.boolean(),
});

export function parseModWarnings(rows: readonly unknown[] | null | undefined): ModWarning[] {
  const out: ModWarning[] = [];
  for (const r of rows ?? []) {
    const p = WarningRow.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      reason: d.reason,
      createdAt: d.created_at,
      expiresAt: d.expires_at,
      revokedAt: u(d.revoked_at),
      revokeNote: u(d.revoke_note),
      reportId: u(d.report_id),
      postId: u(d.post_id),
      moderatorName: u(d.moderator_name),
      active: d.active,
    });
  }
  return out;
}
