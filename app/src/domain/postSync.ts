// Beiträge mit dem Server abgleichen (Etappe 2): was hoch-, nach- oder herunterzuladen ist. Rein, ohne Netz.
import type { Post } from './schemas';

export interface PostSyncPlan {
  /** neu hochladen (Fotos + Eintrag) */
  upload: Post[];
  /** nur Text/Sichtbarkeit nachziehen */
  update: Post[];
  /** vom Server entfernen (gelöscht oder „nicht mehr teilen“) */
  remove: Post[];
}

export function planPostSync(posts: readonly Post[]): PostSyncPlan {
  const plan: PostSyncPlan = { upload: [], update: [], remove: [] };
  for (const p of posts) {
    if (p.deletedAt || p.share === 'unshare') {
      // nur was schon oben ist, muss weg; „pending“ ohne Upload braucht nichts
      if (p.share === 'shared' || p.share === 'unshare') plan.remove.push(p);
    } else if (p.share === 'pending') plan.upload.push(p);
    else if (p.share === 'shared' && p.sharedRev !== p.rev) plan.update.push(p);
  }
  return plan;
}

export type ShareStatus = 'local' | 'pending' | 'shared';
/** Anzeige auf dem Beitrag */
export function shareStatus(p: Pick<Post, 'share'>): ShareStatus {
  return p.share === 'shared' ? 'shared' : p.share === 'pending' ? 'pending' : 'local';
}

/** Dateiendung für den Speicherpfad */
export const photoExt = (mime: string) =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
