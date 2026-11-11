// Erfolge der Teilnehmer für die Visitenkarten: vom Server, soweit die Person sie freigegeben hat (user_achievements).
// Nicht freigegeben oder keine erreicht → kein Eintrag (die Karte zeigt dann nichts).
import { useEffect, useState } from 'react';
import type { Unlocked } from '../../../domain/achievements';
import { useProviders } from '../../../ports/providersContext';

export function useMemberAchievements(userIds: readonly string[]): ReadonlyMap<string, Unlocked> {
  const { account } = useProviders();
  const [found, setFound] = useState<ReadonlyMap<string, Unlocked>>(new Map());
  const key = [...userIds].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let live = true;
    for (const id of key.split(',')) {
      account
        .userAchievements(id)
        .then((r) => {
          if (live && r.visible && Object.keys(r.unlocked).length > 0)
            setFound((prev) => new Map(prev).set(id, r.unlocked));
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [account, key]);
  return found;
}
