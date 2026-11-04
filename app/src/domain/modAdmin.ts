// Moderationsbereich (MODERATION_PLAN.md, Variante A): Zeilen vom Server lesen, Sperrdauer, Restzeit. Rein.
import { z } from 'zod';

export type ModKind = 'post' | 'comment' | 'spot' | 'user';

export interface ModReport {
  id: string;
  kind: ModKind;
  targetId: string;
  reason: string;
  details?: string | undefined;
  status: 'open' | 'done';
  createdAt: string;
  reporterId: string;
  reporterName?: string | undefined;
  targetUserId?: string | undefined;
  targetName?: string | undefined;
  targetUsername?: string | undefined;
  targetBanned: boolean;
  openAgainst: number;
}

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
  status: z.enum(['open', 'done']),
  created_at: z.string(),
  reporter: z.string(),
  reporter_name: opt,
  target_user: opt,
  target_name: opt,
  target_username: opt,
  target_banned: z.boolean().nullable().optional(),
  open_against: z.number().int().nullable().optional(),
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
      reporterId: d.reporter,
      reporterName: u(d.reporter_name),
      targetUserId: u(d.target_user),
      targetName: u(d.target_name),
      targetUsername: u(d.target_username),
      targetBanned: d.target_banned ?? false,
      openAgainst: d.open_against ?? 0,
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
): 'notModerator' | 'self' | 'notFound' | 'noReason' | 'notSignedIn' | 'offline' | 'unknown' {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_moderator')) return 'notModerator';
  if (m.includes('self')) return 'self';
  if (m.includes('not_found') || m.includes('not_banned')) return 'notFound';
  if (m.includes('no_reason')) return 'noReason';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
