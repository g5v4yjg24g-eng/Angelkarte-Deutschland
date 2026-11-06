// Lesezeichen (Paket 7b): welche der gezeigten Beiträge gespeichert sind; Umschalten sofort, bei Fehler zurück.
import { useCallback, useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { useProviders } from '../../ports/providersContext';

export function useSaves(postIds: readonly string[]) {
  const { account } = useProviders();
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string>();
  const key = postIds.join(',');

  useEffect(() => {
    if (!key) return;
    let live = true;
    account
      .savedIds(key.split(','))
      .then((ids) => live && setSaved((cur) => new Set([...cur, ...ids])))
      .catch(() => undefined); // Lesezeichen sind Beiwerk: ohne Netz bleiben sie leer
    return () => {
      live = false;
    };
  }, [account, key]);

  const toggle = useCallback(
    (id: string) => {
      const was = saved.has(id);
      const flip = (on: boolean) =>
        setSaved((cur) => {
          const next = new Set(cur);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        });
      flip(!was);
      setError(undefined);
      account
        .toggleSave(id)
        .then((on) => flip(on))
        .catch(() => {
          flip(was);
          setError(de.feed.saveError);
        });
    },
    [account, saved],
  );

  return { isSaved: (id: string) => saved.has(id), toggle, error, clearError: () => setError(undefined) };
}
