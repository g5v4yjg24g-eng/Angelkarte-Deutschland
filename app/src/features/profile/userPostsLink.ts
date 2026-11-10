import type { FeedPost } from '../../domain/feed';

/** Beitragsansicht einer Person ab diesem Beitrag (darunter die älteren), wie beim eigenen Profil */
export const userPostsLink = (username: string, post: Pick<FeedPost, 'createdAt'>) =>
  `/profil/nutzer/${encodeURIComponent(username)}/beitraege?ab=${encodeURIComponent(post.createdAt)}`;

/** Erste Seite ab einem Zeitpunkt einschließlich: `before` ist auf dem Server „älter als“, deshalb 1 ms später */
export function startCursor(ab: string | null): string | undefined {
  if (!ab) return undefined;
  const t = Date.parse(ab);
  return Number.isFinite(t) ? new Date(t + 1).toISOString() : undefined;
}
