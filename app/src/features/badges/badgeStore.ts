// Abzeichen des angemeldeten Kontos: einmal pro App-Start vom Server lesen (nur wenn eine Anmeldung gespeichert ist)
// und für die Anzeige ohne Netz merken. Vergeben wird ausschließlich auf dem Server (supabase/*_user_badges.sql).
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { badgesFor, readBadgeCache, type Badge } from '../../domain/badges';
import { ACCOUNT_STORAGE_KEY, BADGE_STORAGE_KEY, type AccountProvider } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Nutzer-ID der gespeicherten Anmeldung – ohne den Konto-Anbieter zu laden */
export function storedUserId(): string | undefined {
  try {
    const s = JSON.parse(read(ACCOUNT_STORAGE_KEY) ?? 'null') as { user?: { id?: unknown } } | null;
    return typeof s?.user?.id === 'string' ? s.user.id : undefined;
  } catch {
    return undefined;
  }
}

export function saveBadges(userId: string, badges: Badge[]) {
  try {
    localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify({ userId, badges, checkedAt: Date.now() }));
  } catch {
    // ohne Speicher: Abzeichen erscheinen erst nach dem nächsten Abruf
  }
  emit();
}

export function clearBadges() {
  try {
    localStorage.removeItem(BADGE_STORAGE_KEY);
  } catch {
    // nichts zu tun
  }
  emit();
}

let snapshotKey = '';
let snapshot: Badge[] = [];
function current(userId: string | undefined): Badge[] {
  const raw = read(BADGE_STORAGE_KEY);
  const key = `${userId ?? ''}|${raw ?? ''}`;
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = badgesFor(readBadgeCache(raw), userId);
  }
  return snapshot;
}

let refreshedFor: string | undefined;
/** Abzeichen vom Server holen und merken; Fehler (z. B. offline) lassen den letzten Stand stehen */
export async function refreshBadges(account: AccountProvider, userId: string) {
  refreshedFor = userId;
  try {
    saveBadges(userId, await account.myBadges());
  } catch {
    // letzter bekannter Stand bleibt
  }
}

/**
 * Abzeichen des angemeldeten Kontos; ohne gespeicherte Anmeldung immer leer und ohne Netz.
 * `userId`: bekannte Nutzer-ID (Kontoseite), sonst die der gespeicherten Anmeldung.
 */
export function useMyBadges(userId?: string): Badge[] {
  const { account } = useProviders();
  const snap = useCallback(() => current(userId ?? storedUserId()), [userId]);
  const badges = useSyncExternalStore(subscribe, snap, () => []);
  useEffect(() => {
    if (userId) return; // die Kontoseite liest selbst nach
    const uid = storedUserId();
    if (!account.enabled || !uid || refreshedFor === uid) return;
    void refreshBadges(account, uid);
  }, [account, userId]);
  return badges;
}
