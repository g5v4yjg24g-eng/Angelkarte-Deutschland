// Rückblick gemeinsamer Sessions: eigene Kennzahlen hochladen (nur Zahlen, nur nach dem Ende, nur mit Konto) und die
// der anderen laden. Fehler stören den Rückblick nie – ohne Zahlen bleibt er wie bei einer Einzel-Session.
import { useEffect, useRef, useState } from 'react';
import type { GroupMember } from '../../../domain/groupSessions';
import { statsPayload, type GroupStats, type GroupStatsEntry } from '../../../domain/groupStats';
import { useProviders } from '../../../ports/providersContext';
import { storedUserId } from '../../badges/badgeStore';
import { useGroupMembers } from '../group/useGroupMembers';

export interface GroupStatsState {
  me: string | undefined;
  members: GroupMember[];
  stats: GroupStatsEntry[];
  loading: boolean;
  failed: boolean;
}

export function useGroupStats(
  groupId: string | undefined,
  ended: boolean,
  mine: GroupStats | undefined,
): GroupStatsState | undefined {
  const { account } = useProviders();
  const me = account.enabled ? storedUserId() : undefined;
  const active = !!groupId && !!me;
  const { members, failed: membersFailed } = useGroupMembers(active ? groupId : undefined);
  const [loaded, setLoaded] = useState<{ groupId: string; stats: GroupStatsEntry[] } | 'failed'>();
  const sent = useRef('');
  const key = mine ? JSON.stringify(statsPayload(mine)) : '';

  useEffect(() => {
    if (!active || !groupId) return;
    let live = true;
    (async () => {
      try {
        // erst hochladen (nur beendete Sessions, nur geänderte Zahlen), dann lesen – so sind die eigenen schon dabei
        if (ended && mine && sent.current !== `${groupId}:${key}`) {
          await account.setGroupStats(groupId, mine);
          sent.current = `${groupId}:${key}`;
        }
      } catch {
        // nicht dabei oder offline: lesen wir trotzdem
      }
      try {
        const stats = await account.groupStats(groupId);
        if (live) setLoaded({ groupId, stats });
      } catch {
        if (live) setLoaded('failed');
      }
    })();
    return () => {
      live = false;
    };
    // `mine` steckt im Schlüssel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, active, groupId, ended, key]);

  if (!active) return undefined;
  const ok = loaded && loaded !== 'failed' && loaded.groupId === groupId ? loaded.stats : undefined;
  return {
    me,
    members: (members ?? []).filter((m) => m.status === 'joined' || m.status === 'left'),
    stats: ok ?? [],
    loading: !loaded && !membersFailed,
    failed: loaded === 'failed' || membersFailed,
  };
}
