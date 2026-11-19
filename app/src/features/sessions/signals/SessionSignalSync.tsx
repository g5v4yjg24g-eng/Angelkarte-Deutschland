// Pause, Weiter und Ende in gemeinsamen Sessions (Wunsch Nutzer 2026-11-21), überall in der App (RootLayout):
// 1. Meldet die eigene, mit einer gemeinsamen verknüpfte Session eine Pause, ein Weiter oder ihr Ende, geht eine
//    Meldung an die anderen Teilnehmer (sie bekommen eine Mitteilung). Was von einer angenommenen Meldung stammt, wird
//    nicht zurückgemeldet (data/signalEcho.ts).
// 2. Meldungen der anderen: Fenster „Auch pausieren?“ – Zustimmung ändert die eigene Session zum Zeitpunkt der Meldung.
//    In der iPhone-App kommen auch die Antworten von den Knöpfen am Sperrbildschirm an (Swift-Modul `FangpunktSignals`).
// Gefunden werden Meldungen durch Nachfragen alle 15 Sekunden und beim Zurückkehren in die App, solange sie sichtbar ist.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { getDb } from '../../../data/db';
import { applySignal } from '../../../data/sessionSignalService';
import { consumeEcho } from '../../../data/signalEcho';
import {
  announcement,
  isFreshSignal,
  localState,
  planSignal,
  type LocalState,
  type SessionSignal,
} from '../../../domain/sessionSignals';
import { useOnline } from '../../../lib/useOnline';
import { useProviders } from '../../../ports/providersContext';
import { storedUserId } from '../../badges/badgeStore';
import { usePromptsBlocked } from '../../trips/promptBlock';
import styles from './SessionSignals.module.css';

const t = de.sessionSignal;
const POLL_MS = 15_000;

function SignalPrompt({
  signal,
  onAnswer,
}: {
  signal: SessionSignal;
  onAnswer: (accept: boolean) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const answer = async (accept: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      await onAnswer(accept);
    } catch {
      setError(t.error);
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="session-signal-title"
      // Escape schließt nichts: hier muss eine Entscheidung fallen
      onCancel={(e) => e.preventDefault()}
    >
      <div className={styles.body}>
        <h2 id="session-signal-title" className={styles.title}>
          {t.title}
        </h2>
        <p className={styles.text}>{t.text[signal.kind](signal.byDisplayName)}</p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className={styles.actions}>
          <Button disabled={busy} onClick={() => void answer(true)}>
            {t.accept[signal.kind]}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
            {t.decline}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function SessionSignalSync() {
  const { account, signalActions } = useProviders();
  const online = useOnline();
  const signedIn = account.enabled && !!storedUserId();
  const blocked = usePromptsBlocked();
  const sessions = useLiveQuery(() => getDb().sessions.toArray(), []);

  // 1. Eigene Änderungen melden
  const known = useRef(new Map<string, LocalState>());
  useEffect(() => {
    if (!sessions) return;
    for (const s of sessions) {
      if (s.deletedAt || !s.groupId) {
        known.current.delete(s.id);
        continue;
      }
      const after = localState(s);
      const before = known.current.get(s.id);
      known.current.set(s.id, after);
      const kind = announcement(before, after);
      if (!kind || consumeEcho(s.id, after)) continue;
      if (signedIn) void account.signalSession(s.groupId, kind).catch(() => undefined);
    }
  }, [sessions, account, signedIn]);

  // 2. Meldungen der anderen
  const [signals, setSignals] = useState<SessionSignal[]>([]);
  // beantwortet in diesem Start der App
  const handled = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const answer = useCallback(
    async (signal: SessionSignal, accept: boolean) => {
      if (accept) await applySignal(signal);
      await account.answerSessionSignal(signal.id, accept);
      handled.current.add(signal.id);
      if (mounted.current) setSignals((cur) => cur.filter((x) => x.id !== signal.id));
    },
    [account],
  );

  const refresh = useCallback(async () => {
    const list = await account.sessionSignals();
    const open = list.filter((s) => !handled.current.has(s.id));
    // Antworten von den Knöpfen am Sperrbildschirm zuerst abarbeiten
    for (const a of (await signalActions?.take()) ?? []) {
      const sig = open.find((s) => s.id === a.signalId);
      if (sig) await answer(sig, a.accept).catch(() => undefined);
      else await account.answerSessionSignal(a.signalId, a.accept).catch(() => undefined);
    }
    const now = Date.now();
    const sessionsNow = await getDb().sessions.toArray();
    const rest: SessionSignal[] = [];
    for (const s of open) {
      if (handled.current.has(s.id)) continue;
      const plan = planSignal(
        s,
        sessionsNow.find((x) => !x.deletedAt && x.groupId === s.groupId),
        now,
      );
      // Nichts zu tun (schon pausiert, keine eigene Session dazu, zu alt): still als erledigt melden
      if (plan.action === 'none' || !isFreshSignal(s, now)) {
        handled.current.add(s.id);
        void account.answerSessionSignal(s.id, false).catch(() => undefined);
        continue;
      }
      rest.push(s);
    }
    if (mounted.current) setSignals(rest);
  }, [account, signalActions, answer]);

  useEffect(() => {
    if (!signedIn || !online) return;
    const load = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    const off = signalActions?.onAnswer(load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('focus', load);
      off?.();
    };
  }, [signedIn, online, refresh, signalActions]);

  if (!signedIn || blocked) return null;
  const next = signals[0];
  if (!next) return null;
  return <SignalPrompt key={next.id} signal={next} onAnswer={(accept) => answer(next, accept)} />;
}
