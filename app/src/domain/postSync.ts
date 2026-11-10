// Beiträge mit dem Server abgleichen (Etappe 2; zentrale Bildspeicherung, Freigabe Nutzer 2026-11-10): was hoch-,
// nach- oder herunterzuladen ist, wann es erneut versucht wird und wie der Stand angezeigt wird. Rein, ohne Netz.
import type { Post } from './schemas';

export interface PostSyncPlan {
  /** neu hochladen (Fotos + Eintrag) */
  upload: Post[];
  /** nur Text/Sichtbarkeit nachziehen */
  update: Post[];
  /** vom Server entfernen (gelöscht oder „nicht mehr teilen“ aus älteren Versionen) */
  remove: Post[];
}

/** Gehört der Beitrag zu diesem Konto? Ohne Zuordnung (älter als die Zuordnung) gilt er als eigener. */
export const belongsTo = (p: Pick<Post, 'accountId'>, userId: string) =>
  p.accountId === undefined || p.accountId === userId;

/** Darf jetzt (wieder) versucht werden? */
export const due = (p: Pick<Post, 'syncRetryAt'>, now: number) =>
  !p.syncRetryAt || Date.parse(p.syncRetryAt) <= now;

export function planPostSync(posts: readonly Post[], userId: string, now: number): PostSyncPlan {
  const plan: PostSyncPlan = { upload: [], update: [], remove: [] };
  for (const p of posts) {
    if (!belongsTo(p, userId)) continue;
    if (p.deletedAt || p.share === 'unshare') {
      // nur was schon oben ist, muss weg; „pending“ ohne Upload braucht nichts
      if (p.share === 'shared' || p.share === 'unshare') plan.remove.push(p);
    } else if (p.share === 'pending') {
      // fehlende Fotodatei: kein Versuch mehr, bis der Beitrag geändert wird
      if (p.syncError !== 'photo_missing' && due(p, now)) plan.upload.push(p);
    } else if (p.share === 'shared' && p.sharedRev !== p.rev && due(p, now)) plan.update.push(p);
  }
  return plan;
}

/**
 * Automatische Übertragung (ersetzt „nie automatisch“, Freigabe Nutzer 2026-11-10): Beiträge, die nur auf dem
 * Gerät liegen, werden mit dem angemeldeten Konto gesichert – ohne Sichtbarkeit als „Nur ich“.
 */
export const postsToAdopt = (posts: readonly Post[], userId: string): Post[] =>
  posts.filter((p) => !p.deletedAt && !p.share && belongsTo(p, userId));

/** Wartezeiten nach Fehlschlägen (Minuten): 1, 5, 30 min, 2 h, 6 h, dann alle 12 h – höchstens etwa 6 am Tag */
export const RETRY_MINUTES = [1, 5, 30, 120, 360, 720] as const;
export function retryAt(attempts: number, now: number): string {
  const i = Math.min(Math.max(attempts, 1), RETRY_MINUTES.length) - 1;
  return new Date(now + (RETRY_MINUTES[i] ?? 720) * 60_000).toISOString();
}

/** Nächster Zeitpunkt, an dem ein wartender Beitrag wieder dran ist (für den Wecker im Hintergrund) */
export function nextWake(posts: readonly Post[], now: number): number | undefined {
  let next: number | undefined;
  for (const p of posts) {
    if (p.deletedAt || !p.syncRetryAt || p.syncError === 'photo_missing') continue;
    if (p.share !== 'pending' && !(p.share === 'shared' && p.sharedRev !== p.rev)) continue;
    const t = Date.parse(p.syncRetryAt);
    if (t > now && (next === undefined || t < next)) next = t;
  }
  return next;
}

export type ShareStatus = 'local' | 'pending' | 'shared' | 'failed' | 'limited' | 'missing';
/** Anzeige auf dem Beitrag */
export function shareStatus(p: Pick<Post, 'share' | 'syncError'>): ShareStatus {
  if (p.share === 'shared') return 'shared';
  if (p.share !== 'pending') return 'local';
  if (p.syncError === 'photo_missing') return 'missing';
  if (p.syncError === 'limited') return 'limited';
  if (p.syncError === 'failed') return 'failed';
  return 'pending';
}

export interface SyncSummary {
  /** Beiträge dieses Kontos (ohne gelöschte) */
  total: number;
  /** auf dem Server gesichert */
  saved: number;
  /** warten noch auf die Übertragung */
  waiting: number;
  /** Übertragung fehlgeschlagen (wird später erneut versucht) bzw. Fotodatei fehlt */
  failed: number;
  missing: number;
}

export function syncSummary(posts: readonly Post[], userId: string): SyncSummary {
  const s: SyncSummary = { total: 0, saved: 0, waiting: 0, failed: 0, missing: 0 };
  for (const p of posts) {
    if (p.deletedAt || !belongsTo(p, userId)) continue;
    s.total++;
    const st = shareStatus(p);
    if (st === 'shared') s.saved++;
    else if (st === 'missing') s.missing++;
    else if (st === 'failed') s.failed++;
    else s.waiting++;
  }
  return s;
}

/** Dateiendung für den Speicherpfad */
export const photoExt = (mime: string) =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

/** Speicherpfade eines Fotos: `<Nutzer>/<Beitrag>/<Nr>.<Endung>` und das Vorschaubild `<Nr>.thumb.jpg` */
export const photoPath = (userId: string, postId: string, index: number, mime: string) =>
  `${userId}/${postId}/${index + 1}.${photoExt(mime)}`;
export const thumbPath = (photo: string) => photo.replace(/\.(jpg|png|webp)$/, '.thumb.jpg');
/** Bildformat aus dem Pfad (für vom Server geholte Fotos) */
export const mimeOfPath = (path: string): 'image/jpeg' | 'image/png' | 'image/webp' =>
  path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
