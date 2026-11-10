// Gleicht die freiwilligen Profilangaben (Paket 11/12) im Hintergrund mit dem Server ab, damit Freunde sie sehen –
// nur angemeldet und online, nur bei Änderung. Gemerkt wird je Konto, welcher Stand oben ist; schlägt es fehl
// (z. B. noch kein Server-Profil), folgt der nächste Versuch beim nächsten Start oder bei der nächsten Änderung.
import { useEffect, useRef } from 'react';
import { extrasKey, extrasPayload } from '../../domain/userProfile';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { usePosts, useProfile } from './usePhoto';

export const EXTRAS_SYNC_KEY = 'fangpunkt.profileExtrasSynced';

const read = () => {
  try {
    return localStorage.getItem(EXTRAS_SYNC_KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(EXTRAS_SYNC_KEY, v);
  } catch {
    // Speicher gesperrt: beim nächsten Start erneut
  }
};

export function ProfileExtrasSync() {
  const { account } = useProviders();
  const online = useOnline();
  const profile = useProfile();
  const posts = usePosts();
  const running = useRef(false);
  const me = storedUserId();
  const payload = profile && posts ? extrasPayload(profile, posts) : undefined;
  const key = me && payload ? extrasKey(me, payload) : undefined;

  useEffect(() => {
    if (!key || !payload || !online || !account.enabled || running.current || read() === key) return;
    running.current = true;
    account
      .setProfileExtras(payload)
      .then(() => write(key))
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
    // payload hängt vollständig an key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online, account]);

  return null;
}
