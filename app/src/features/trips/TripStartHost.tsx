// Gemeinsamer Start eines Angeltermins (Wunsch Nutzer 2026-11-11), überall in der App (RootLayout):
// - Ersteller: Fenster „Warte auf …“, solange keine eingeladene Person bestätigt hat; erst dann startet seine
//   Session. Nach 2 Minuten (oder wenn alle abgelehnt haben) kommt „Ohne … starten“, „Abbrechen“ gibt es immer.
// - Eingeladene: Fenster „Session starten?“ mit „Dabei sein“ – egal in welchem Bereich, nur nicht beim Hochladen
//   von Profilbild und Beiträgen (promptBlock). Gefunden wird die Anfrage über die Mitteilung und durch Nachfragen
//   alle 10 Sekunden, solange die App sichtbar ist.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { GroupSessionBusyError, joinGroupLocally } from '../../data/groupSessionService';
import type { GroupMember } from '../../domain/groupSessions';
import {
  canStartWithout,
  requestFresh,
  requestLabel,
  waitState,
  type PendingStart,
  type StartRequest,
} from '../../domain/tripStart';
import { useNow } from '../../lib/useNow';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { groupErrorText } from '../sessions/group/groupText';
import { usePendingStart, writePending } from './pendingStart';
import { usePromptsBlocked } from './promptBlock';
import styles from './TripStart.module.css';

const t = de.tripStart;
const POLL_MS = 10_000;
const WAIT_POLL_MS = 3_000;

/** „A“, „A und B“, „A, B und C“ */
const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;

function Modal({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="trip-start-title"
      // Escape schließt nichts: hier muss eine Entscheidung fallen
      onCancel={(e) => e.preventDefault()}
    >
      <div className={styles.body}>
        <h2 id="trip-start-title" className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

function WaitDialog({ pending }: { pending: PendingStart }) {
  const { account } = useProviders();
  const navigate = useNavigate();
  const now = useNow(1000);
  const [members, setMembers] = useState<GroupMember[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const blocked = usePromptsBlocked();
  const started = useRef(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      account
        .groupSessionMembers(pending.groupId)
        .then((list) => live && setMembers(list))
        .catch(() => undefined); // ohne Verbindung einfach weiter warten
    void load();
    const timer = window.setInterval(() => void load(), WAIT_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [account, pending.groupId]);

  const state = members ? waitState(members) : 'waiting';

  /** Eigene Session starten; liefert einen Fehlertext oder nichts */
  const startLocal = useCallback(async (): Promise<string | undefined> => {
    if (started.current) return undefined;
    started.current = true;
    try {
      const local = await joinGroupLocally({ id: pending.groupId, title: pending.title });
      writePending(undefined);
      navigate(`/fangbuch/sessions/${local.id}`);
      return undefined;
    } catch (e) {
      started.current = false;
      return e instanceof GroupSessionBusyError ? t.busy : t.errorStart;
    }
  }, [navigate, pending.groupId, pending.title]);

  // Bestätigt → Session startet; nicht mitten im Hochladen (promptBlock), sonst ginge dort etwas verloren
  useEffect(() => {
    if (state === 'confirmed' && !blocked)
      void startLocal().then((err) => {
        if (err) setError(err);
      });
  }, [state, blocked, startLocal]);

  const cancel = async () => {
    setBusy(true);
    try {
      await account.endGroupSession(pending.groupId);
    } catch {
      // schon beendet oder offline: die Anfrage läuft nach 6 Stunden von selbst aus
    }
    writePending(undefined);
  };

  if (blocked) return null;
  const names = joinNames(pending.names);
  const declinedNames =
    members
      ?.filter((m) => !m.isHost && (m.status === 'declined' || m.status === 'left'))
      .map((m) => m.displayName) ?? [];
  const escape = canStartWithout(state, pending.since, now);
  return (
    <Modal title={t.waitTitle}>
      {state === 'declined' ? (
        <p className={styles.text}>{pending.names.length > 1 ? t.allDeclined : t.declined(names)}</p>
      ) : (
        <div className={styles.waitRow}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.text} role="status">
            {names ? t.waiting(names) : t.waitingAny}
          </p>
        </div>
      )}
      {state !== 'declined' && declinedNames.length > 0 && (
        <p className="muted">{t.declined(joinNames(declinedNames))}</p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        {escape && (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void startLocal().then((err) => {
                if (err) {
                  setBusy(false);
                  setError(err);
                }
              });
            }}
          >
            {names ? t.startWithout(names) : t.startWithoutAny}
          </Button>
        )}
        <Button variant={escape ? 'secondary' : 'primary'} disabled={busy} onClick={() => void cancel()}>
          {t.cancel}
        </Button>
      </div>
    </Modal>
  );
}

function RequestPrompt({ request, onDone }: { request: StartRequest; onDone: (id: string) => void }) {
  const { account } = useProviders();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const label = requestLabel(request);
      // erst lokal prüfen (läuft schon eine andere gemeinsame Session?), dann zusagen – wie bei Einladungen
      const local = await joinGroupLocally({ id: request.id, title: label }).catch((e: unknown) => {
        throw e instanceof GroupSessionBusyError ? new Error(t.promptBusy) : e;
      });
      await account.respondGroupInvite(request.id, true);
      onDone(request.id);
      navigate(`/fangbuch/sessions/${local.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message === t.promptBusy ? t.promptBusy : groupErrorText(e));
      setBusy(false);
    }
  };
  const decline = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await account.respondGroupInvite(request.id, false);
      onDone(request.id);
    } catch (e) {
      setError(groupErrorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={t.promptTitle}>
      <p className={styles.text}>{t.prompt(request.hostDisplayName, requestLabel(request))}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        <Button disabled={busy} onClick={() => void confirm()}>
          {t.confirm}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void decline()}>
          {t.decline}
        </Button>
      </div>
    </Modal>
  );
}

export function TripStartHost() {
  const { account } = useProviders();
  const online = useOnline();
  const signedIn = account.enabled && !!storedUserId();
  const pending = usePendingStart();
  const blocked = usePromptsBlocked();
  const now = useNow(POLL_MS);
  const [requests, setRequests] = useState<StartRequest[]>([]);
  // beantwortet oder weggeklickt in diesem Start der App
  const [handled, setHandled] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!signedIn || !online) return;
    let live = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      account
        .startRequests()
        .then((list) => live && setRequests(list))
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('focus', load);
    };
  }, [account, signedIn, online]);

  if (!signedIn) return null;
  // erst das eigene Warten, dann Anfragen an mich
  if (pending) return <WaitDialog pending={pending} />;
  if (blocked) return null;
  const next = requests.find((r) => !handled.has(r.id) && requestFresh(r, now));
  if (!next) return null;
  return (
    <RequestPrompt key={next.id} request={next} onDone={(id) => setHandled((cur) => new Set(cur).add(id))} />
  );
}
