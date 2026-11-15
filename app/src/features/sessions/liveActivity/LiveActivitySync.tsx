// Hält die Live Activity (Sperrbildschirm, Dynamic Island) mit der laufenden Session im Gleichen – nur in der iPhone-App
// (Anbieter fehlt im Browser) und nur, wenn die Einstellung „Live Activity“ an ist. Regeln rein in domain/liveActivity.ts:
// Start bei laufender Session, Aktualisierung bei Pause, Fang, Biss und neuer Strecke, Ende mit Zusammenfassung.
// Die Angelzeit zählt das System von selbst. Fehler stören nie.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { getDb } from '../../../data/db';
import { useCatches } from '../../../data/useCatches';
import { getTrack } from '../../../data/trackService';
import {
  liveKey,
  livePayload,
  nextLiveAction,
  type LiveMemory,
  type LivePayload,
} from '../../../domain/liveActivity';
import { trackDistanceM } from '../../../domain/track';
import { useProviders } from '../../../ports/providersContext';
import { useBoolSetting } from '../../settings/useBoolSetting';
import { useRunningSession } from '../useSessions';

export function LiveActivitySync() {
  const { liveActivity } = useProviders();
  const enabled = useBoolSetting('liveActivity', true);
  const showTitle = useBoolSetting('liveActivityTitle', true);
  const running = useRunningSession();
  const catches = useCatches();
  const distanceM = useLiveQuery(async () => {
    if (!running) return undefined;
    const t = await getTrack(running.id);
    return t ? trackDistanceM(t.segments) : undefined;
  }, [running?.id]);
  const memory = useRef<LiveMemory>({});
  // Aufrufe nacheinander ausführen, damit schnelle Änderungen sich nicht überholen
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!liveActivity || enabled === undefined || running === undefined || catches === undefined) return;
    const run = async () => {
      let payload: LivePayload | undefined;
      let key: string | undefined;
      if (running) {
        payload = livePayload(running, catches, distanceM, {
          showTitle: showTitle !== false,
          nowMs: Date.now(),
        });
        key = liveKey(payload, running);
      }
      // Keine laufende Session mehr: war eine angezeigt, jetzt mit Zusammenfassung beenden
      if (!running && memory.current.sessionId && !memory.current.ended) {
        const ended = await getDb().sessions.get(memory.current.sessionId);
        if (ended?.endAt && !ended.deletedAt) {
          payload = livePayload(ended, catches, undefined, {
            showTitle: showTitle !== false,
            nowMs: Date.now(),
          });
          key = liveKey(payload, ended);
        }
      }
      const { action, memory: next } = nextLiveAction(memory.current, payload, key, enabled);
      memory.current = next;
      if (!action) return;
      if (action.kind === 'end') await liveActivity.end(action.sessionId, action.payload, action.keepSeconds);
      else if (action.kind === 'start') await liveActivity.start(action.payload);
      else await liveActivity.update(action.payload);
    };
    chain.current = chain.current.then(run).catch(() => undefined);
  }, [liveActivity, enabled, running, catches, distanceM, showTitle]);

  return null;
}
