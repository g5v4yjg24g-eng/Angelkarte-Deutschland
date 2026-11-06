// Lädt im Hintergrund das eigene Profilbild hoch bzw. entfernt es auf dem Server (Paket 2b) – nur angemeldet und
// online. Gemerkt wird je Konto, welches lokale Bild oben ist (domain/avatarSync.ts); ohne Server-Profil passiert
// nichts (nächster Versuch beim nächsten Start oder bei der nächsten Änderung).
import { useEffect, useRef } from 'react';
import { getDb } from '../../data/db';
import { AVATAR_MAX_BYTES, parseSynced, planAvatarSync, type AvatarSynced } from '../../domain/avatarSync';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { invalidateAvatar } from './avatarUrls';
import { useProfile } from './usePhoto';

export const AVATAR_SYNC_KEY = 'fangpunkt.avatarSynced';

function readSynced(): AvatarSynced | undefined {
  try {
    return parseSynced(localStorage.getItem(AVATAR_SYNC_KEY));
  } catch {
    return undefined;
  }
}
function writeSynced(v: AvatarSynced) {
  try {
    localStorage.setItem(AVATAR_SYNC_KEY, JSON.stringify(v));
  } catch {
    // Speicher gesperrt: beim nächsten Start wird erneut abgeglichen
  }
}

export function AvatarSync() {
  const { account } = useProviders();
  const online = useOnline();
  const profile = useProfile();
  const running = useRef(false);
  const loaded = profile !== undefined;
  const photoId = profile?.avatarPhotoId;

  useEffect(() => {
    const me = storedUserId();
    if (!loaded || !online || !account.enabled || !me || running.current) return;
    const plan = planAvatarSync(photoId, readSynced(), me);
    if (plan === 'none') return;
    running.current = true;
    const work = async () => {
      if (plan === 'clear') {
        await account.publishAvatar(null);
        writeSynced({ userId: me, photoId: null });
      } else if (photoId) {
        const photo = await getDb().photos.get(photoId);
        if (!photo || photo.mime !== 'image/jpeg') return;
        // Zugeschnittene Bilder sind 512 × 512; ältere große Bilder als Vorschaubild hochladen
        const blob = photo.blob.size <= AVATAR_MAX_BYTES ? photo.blob : photo.thumb;
        if (!blob || blob.size > AVATAR_MAX_BYTES) return;
        await account.publishAvatar(blob);
        writeSynced({ userId: me, photoId });
      }
      invalidateAvatar(me);
    };
    work()
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
  }, [loaded, photoId, online, account]);

  return null;
}
