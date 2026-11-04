// „Gefällt mir“ und Kommentare auf dem Server (Wunsch Nutzer 2026-11-04). Rein, ohne Netz.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';

export interface ServerReactions {
  likeCount: number;
  liked: boolean;
  commentCount: number;
}

export interface ServerComment {
  id: string;
  authorId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  text: string;
  createdAt: string;
  /** eigener Kommentar oder Kommentar unter dem eigenen Beitrag */
  canDelete: boolean;
}

export const NO_REACTIONS: ServerReactions = { likeCount: 0, liked: false, commentCount: 0 };

const ReactionRowSchema = z.object({
  post_id: z.string(),
  like_count: z.number().int().min(0),
  liked: z.boolean(),
  comment_count: z.number().int().min(0),
});

export function parseReactionRows(rows: readonly unknown[] | null | undefined): Map<string, ServerReactions> {
  const out = new Map<string, ServerReactions>();
  for (const r of rows ?? []) {
    const p = ReactionRowSchema.safeParse(r);
    if (p.success)
      out.set(p.data.post_id, {
        likeCount: p.data.like_count,
        liked: p.data.liked,
        commentCount: p.data.comment_count,
      });
  }
  return out;
}

const CommentRowSchema = z.object({
  id: z.string(),
  author_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  body: z.string().min(1),
  created_at: z.string(),
  can_delete: z.boolean().optional(),
});

export function parseCommentRows(rows: readonly unknown[] | null | undefined): ServerComment[] {
  const out: ServerComment[] = [];
  for (const r of rows ?? []) {
    const p = CommentRowSchema.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      authorId: d.author_id,
      username: d.username,
      displayName: d.display_name,
      badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
      text: d.body,
      createdAt: d.created_at,
      canDelete: d.can_delete ?? false,
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Sofort anzeigen, bevor der Server antwortet: Daumen umschalten und Zahl anpassen */
export function toggledReactions(r: ServerReactions): ServerReactions {
  return { ...r, liked: !r.liked, likeCount: Math.max(0, r.likeCount + (r.liked ? -1 : 1)) };
}

export function reactionErrorKind(
  e: { message?: string; status?: number } | undefined,
): 'notFound' | 'tooMany' | 'notSignedIn' | 'offline' | 'unknown' {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_found')) return 'notFound';
  if (m.includes('too_many')) return 'tooMany';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
