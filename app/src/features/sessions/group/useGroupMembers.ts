// Teilnehmer einer gemeinsamen Session vom Server laden (nur angemeldet). Mit `poll` fragt die Seite alle 15 s
// nach, solange sie sichtbar ist – so erscheint eine Zusage, ohne dass man neu laden muss.
import { useEffect, useState } from 'react';
import type { GroupMember } from '../../../domain/groupSessions';
import { useProviders } from '../../../ports/providersContext';
import { storedUserId } from '../../badges/badgeStore';

export const MEMBERS_POLL_MS = 15_000;

type Loaded = { groupId: string; members: GroupMember[] } | { groupId: string; failed: true };

export function useGroupMembers(
  groupId: string | undefined,
  poll = false,
): { members: GroupMember[] | undefined; failed: boolean; reload: () => void } {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [state, setState] = useState<Loaded>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!signedIn || !groupId) return;
    let live = true;
    account
      .groupSessionMembers(groupId)
      .then((members) => live && setState({ groupId, members }))
      .catch(() => live && setState({ groupId, failed: true }));
    return () => {
      live = false;
    };
  }, [account, signedIn, groupId, tick]);

  useEffect(() => {
    if (!poll || !signedIn || !groupId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    }, MEMBERS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll, signedIn, groupId]);

  const current = state && state.groupId === groupId ? state : undefined;
  return {
    members: current && 'members' in current ? current.members : undefined,
    failed: !!current && 'failed' in current,
    reload: () => setTick((n) => n + 1),
  };
}
