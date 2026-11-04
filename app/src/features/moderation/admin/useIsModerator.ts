// Ist das angemeldete Konto Moderator? Entscheidet nur der Server (Tabelle moderators); hier nur zum Ein-/Ausblenden.
// Einmal je Konto und App-Start gefragt.
import { useEffect, useState } from 'react';
import { useProviders } from '../../../ports/providersContext';
import { storedUserId } from '../../badges/badgeStore';

const cache = new Map<string, boolean>();

export function useIsModerator(): boolean | undefined {
  const { account } = useProviders();
  const userId = account.enabled ? storedUserId() : undefined;
  const [answer, setAnswer] = useState<{ userId: string; value: boolean }>();
  useEffect(() => {
    if (!userId || cache.has(userId)) return;
    let live = true;
    account
      .isModerator()
      .catch(() => false)
      .then((value) => {
        cache.set(userId, value);
        if (live) setAnswer({ userId, value });
      });
    return () => {
      live = false;
    };
  }, [account, userId]);
  if (!userId) return false;
  if (cache.has(userId)) return cache.get(userId);
  return answer?.userId === userId ? answer.value : undefined;
}
