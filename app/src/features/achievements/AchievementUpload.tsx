// Lädt die erreichten Stufen im Hintergrund hoch (Paket B), damit andere sie im Profil sehen können – wer genau,
// entscheidet die eigene Einstellung auf dem Server. Nur angemeldet und online, nur wenn neue Stufen dazukommen
// (Merker je Konto). Übertragen werden nur Stufe und Datum, keine Fänge.
import { useEffect, useRef } from 'react';
import { uploadEntries, uploadKey } from '../../domain/sharedAchievements';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { useAchievements } from './useAchievements';

export const ACH_UPLOAD_KEY = 'fangpunkt.achievementsSynced';

const read = () => {
  try {
    return localStorage.getItem(ACH_UPLOAD_KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(ACH_UPLOAD_KEY, v);
  } catch {
    // Speicher gesperrt: beim nächsten Start erneut (der Server nimmt Doppeltes nicht doppelt)
  }
};

export function AchievementUpload() {
  const { account } = useProviders();
  const online = useOnline();
  const state = useAchievements();
  const running = useRef(false);
  const me = storedUserId();
  const entries = state?.unlocked ? uploadEntries(state.unlocked) : undefined;
  const key = me && entries && Object.keys(entries).length ? uploadKey(me, entries) : undefined;

  useEffect(() => {
    if (!key || !entries || !online || !account.enabled || running.current || read() === key) return;
    running.current = true;
    account
      .setMyAchievements(entries)
      .then(() => write(key))
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
    // entries hängt vollständig an key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online, account]);

  return null;
}
