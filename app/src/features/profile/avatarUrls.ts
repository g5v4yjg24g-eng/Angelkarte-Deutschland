// Profilbilder anderer Konten (Paket 2b): Adressen vom Server, gesammelt abgefragt und zwischengespeichert.
// Die Adressen gelten 1 h; nach 50 min wird neu gefragt. Ein neues Bild hat einen neuen Pfad, also eine neue Adresse.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AccountProvider } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

const TTL_MS = 50 * 60 * 1000;
const RETRY_MS = 60 * 1000;

interface Entry {
  url: string | null;
  until: number;
}

const cache = new Map<string, Entry>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  version += 1;
  for (const l of listeners) l();
}

function flush(account: AccountProvider) {
  timer = undefined;
  const batch = [...pending].slice(0, 200);
  for (const id of batch) pending.delete(id);
  if (batch.length === 0) return;
  account
    .avatarUrls(batch)
    .then((urls) => {
      const until = Date.now() + TTL_MS;
      for (const id of batch) cache.set(id, { url: urls.get(id) ?? null, until });
      emit();
    })
    .catch(() => {
      // Ohne Netz o. Ä.: Platzhalter zeigen, in einer Minute erneut versuchen
      const until = Date.now() + RETRY_MS;
      for (const id of batch) cache.set(id, { url: cache.get(id)?.url ?? null, until });
      emit();
    });
  if (pending.size) timer = setTimeout(() => flush(account), 0);
}

function request(account: AccountProvider, ids: readonly string[]) {
  const now = Date.now();
  for (const id of ids) {
    const e = cache.get(id);
    if (!e || e.until <= now) pending.add(id);
  }
  if (pending.size && !timer) timer = setTimeout(() => flush(account), 0);
}

/** Nach eigenem Hochladen/Entfernen oder Moderation: neu fragen */
export function invalidateAvatar(userId: string) {
  cache.delete(userId);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => version;

/** Adressen der Profilbilder (nur angemeldet). Fehlt eine, wird ein Platzhalter gezeigt. */
export function useAvatarUrls(userIds: readonly string[]): ReadonlyMap<string, string> {
  const { account } = useProviders();
  const v = useSyncExternalStore(subscribe, snapshot, snapshot);
  const key = [...new Set(userIds)].sort().join(',');
  useEffect(() => {
    if (!key || !account.enabled || !storedUserId()) return;
    request(account, key.split(','));
  }, [account, key, v]);
  return useMemo(() => {
    void v;
    const out = new Map<string, string>();
    for (const id of key ? key.split(',') : []) {
      const url = cache.get(id)?.url;
      if (url) out.set(id, url);
    }
    return out;
  }, [key, v]);
}

export function useAvatarUrl(userId: string | undefined): string | undefined {
  return useAvatarUrls(userId ? [userId] : []).get(userId ?? '');
}
