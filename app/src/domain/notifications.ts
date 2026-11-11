// Mitteilungen in der App (Wunsch Nutzer 2026-11-11): Liste im Feed mit Gefällt mir, Kommentaren, Folgen, Einladungen
// und Session-Beginn. Rein, ohne Netz: Zeilen prüfen, Ziel und Zahl bestimmen.
import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'friend_request',
  'friend_accepted',
  'new_follower',
  'like',
  'comment',
  'comment_reply',
  'spot',
  'session_invite',
  'session_joined',
  'session_highlight',
  'trip_invite',
  'trip_start',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  username: string;
  displayName: string;
  /** Bezug: Beitrag, Session, Termin (je nach Art) */
  ref?: string | undefined;
  excerpt?: string | undefined;
  createdAt: string;
  /** beim Laden schon gelesen (die Liste markiert beim Öffnen, zeigt „Neu“ aber nach dem Stand davor) */
  read: boolean;
  /** nur bei Beitragsbezug und nur, wenn ich den Beitrag sehen darf */
  post?: { authorUsername: string; createdAt: string; mine: boolean } | undefined;
}

/** So viele Mitteilungen je Seite */
export const NOTIFICATIONS_PAGE = 30;

const RowSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  actor_id: z.string(),
  actor_username: z.string(),
  actor_display_name: z.string(),
  ref: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  created_at: z.string(),
  is_read: z.boolean(),
  post_author_username: z.string().nullable().optional(),
  post_created_at: z.string().nullable().optional(),
  post_is_mine: z.boolean().nullable().optional(),
});

/** Zeilen vom Server prüfen; unbekannte Arten (neuere Datenbank) und kaputte Zeilen werden übersprungen */
export function parseNotifications(rows: readonly unknown[] | null | undefined): AppNotification[] {
  const out: AppNotification[] = [];
  for (const row of rows ?? []) {
    const p = RowSchema.safeParse(row);
    if (!p.success) continue;
    const r = p.data;
    out.push({
      id: r.id,
      kind: r.kind,
      actorId: r.actor_id,
      username: r.actor_username,
      displayName: r.actor_display_name,
      ref: r.ref ?? undefined,
      excerpt: r.excerpt ?? undefined,
      createdAt: r.created_at,
      read: r.is_read,
      post:
        r.post_author_username && r.post_created_at
          ? {
              authorUsername: r.post_author_username,
              createdAt: r.post_created_at,
              mine: r.post_is_mine === true,
            }
          : undefined,
    });
  }
  return out;
}

/** Zahl am Fisch: nichts bei 0, ab 10 „9+“ */
export function badgeLabel(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return count > 9 ? '9+' : String(Math.floor(count));
}

/** Zahl des Servers prüfen (ganze Zahl ≥ 0, sonst 0) */
export function parseUnreadCount(data: unknown): number {
  const n = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Wohin eine Mitteilung führt (nur bekannte Ziele in der App). Eigener Beitrag → Beitragsseite, fremder Beitrag →
 * Beiträge der Person ab diesem Beitrag. Ist der Beitrag nicht (mehr) sichtbar, gibt es kein Ziel.
 */
export function notificationPath(n: AppNotification): string | undefined {
  switch (n.kind) {
    case 'like':
    case 'comment':
    case 'comment_reply':
      if (!n.post || !n.ref) return undefined;
      return n.post.mine
        ? `/profil/beitrag/${encodeURIComponent(n.ref)}`
        : `/profil/nutzer/${encodeURIComponent(n.post.authorUsername)}/beitraege?ab=${encodeURIComponent(n.post.createdAt)}`;
    case 'new_follower':
    case 'friend_accepted':
      return `/profil/nutzer/${encodeURIComponent(n.username)}`;
    case 'friend_request':
      return '/profil/freunde';
    case 'spot':
      return '/profil/spots';
    case 'session_invite':
    case 'session_joined':
    case 'session_highlight':
    case 'trip_start':
      return '/fangbuch/sessions';
    case 'trip_invite':
      return '/wetter/kalender';
  }
}

/** „vor 5 Min.“, „vor 2 Std.“, „vor 3 Tagen“, ab einer Woche das Datum */
export function timeAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(t).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Berlin',
  });
}

/** Neue (beim Öffnen ungelesen) zuerst getrennt von den älteren – Reihenfolge innerhalb bleibt */
export function splitNew(list: readonly AppNotification[]): {
  fresh: AppNotification[];
  earlier: AppNotification[];
} {
  return { fresh: list.filter((n) => !n.read), earlier: list.filter((n) => n.read) };
}

/** Nachladen: Cursor der letzten Zeile; ohne volle Seite gibt es nichts mehr */
export const hasMoreNotifications = (lastPageSize: number) => lastPageSize >= NOTIFICATIONS_PAGE;

/** Wischen nach rechts schließt: ab 30 % der Breite oder schnell (≥ 0,4 px/ms über mindestens 30 px). dx > 0 = nach rechts */
export function shouldDismissRight(dx: number, ms: number, width: number): boolean {
  if (dx <= 0 || width <= 0) return false;
  const fast = dx >= 30 && dx / Math.max(1, ms) >= 0.4;
  return fast || dx >= width * 0.3;
}
