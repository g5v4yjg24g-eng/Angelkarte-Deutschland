import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { getSetting } from '../../data/settings';
import { parseUnlocked, progressFrom, type Progress, type Unlocked } from '../../domain/achievements';

/** Stündlich neu rechnen: Fänge zählen erst nach einem Tag im Fangbuch */
function useHourTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Stand (aus Fangbuch und Sessions) und gespeicherte Stufen; undefined, solange geladen wird */
export function useAchievements():
  { progress: Progress; unlocked: Unlocked | undefined; stored: boolean; fresh: string[] } | undefined {
  const now = useHourTick();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [catches, sessions, raw, fresh] = await Promise.all([
      db.catches.toArray(),
      db.sessions.toArray(),
      getSetting('achievements', db),
      getSetting('achievementsNew', db),
    ]);
    return {
      catches,
      sessions,
      unlocked: parseUnlocked(raw),
      fresh: Array.isArray(fresh) ? fresh.filter((k): k is string => typeof k === 'string') : [],
    };
  }, []);
  return useMemo(
    () =>
      data && {
        progress: progressFrom(data.catches, data.sessions, now),
        unlocked: data.unlocked,
        stored: data.unlocked !== undefined,
        fresh: data.fresh,
      },
    [data, now],
  );
}
