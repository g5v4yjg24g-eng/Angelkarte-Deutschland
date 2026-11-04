// „Gefällt mir“ und Kommentarzahl geteilter Beiträge vom Server (Wunsch Nutzer 2026-11-04).
// Der Daumen schaltet sofort um; schlägt der Server fehl, springt er zurück.
import { useCallback, useEffect, useState } from 'react';
import { NO_REACTIONS, toggledReactions, type ServerReactions } from '../../domain/reactions';
import { useProviders } from '../../ports/providersContext';
import { reactionErrorText } from './reactionErrors';

export function useServerReactions(postIds: readonly string[], enabled = true) {
  const { account } = useProviders();
  const [map, setMap] = useState<Map<string, ServerReactions>>(new Map());
  const [error, setError] = useState<string>();
  const key = postIds.join(',');

  const reload = useCallback(() => {
    if (!enabled || !key) return;
    account
      .postReactions(key.split(','))
      .then((m) => setMap((cur) => new Map([...cur, ...m])))
      .catch(() => undefined); // Zahlen sind Beiwerk: ohne Netz bleiben sie leer
  }, [account, enabled, key]);

  useEffect(reload, [reload]);

  const get = useCallback((id: string) => map.get(id) ?? NO_REACTIONS, [map]);

  const toggle = useCallback(
    (id: string) => {
      const before = map.get(id) ?? NO_REACTIONS;
      setMap((cur) => new Map(cur).set(id, toggledReactions(before)));
      setError(undefined);
      account
        .toggleLike(id)
        .then((liked) => {
          // Server ist maßgeblich (z. B. bei Doppeltipp auf zwei Geräten)
          if (liked !== !before.liked) reload();
        })
        .catch((e: unknown) => {
          setMap((cur) => new Map(cur).set(id, before));
          setError(reactionErrorText(e));
        });
    },
    [account, map, reload],
  );

  /** Kommentarzahl nach Schreiben/Löschen anpassen, ohne neu zu laden */
  const addComments = useCallback((id: string, delta: number) => {
    setMap((cur) => {
      const r = cur.get(id) ?? NO_REACTIONS;
      return new Map(cur).set(id, { ...r, commentCount: Math.max(0, r.commentCount + delta) });
    });
  }, []);

  return { get, toggle, reload, addComments, error, clearError: () => setError(undefined) };
}
