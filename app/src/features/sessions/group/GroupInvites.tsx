// Offene Einladungen zu gemeinsamen Sessions (Paket 8a) oben in der Session-Liste: zusagen oder ablehnen.
// Zusagen startet eine eigene Session (oder verknüpft die laufende).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { de } from '../../../i18n/de';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { groupLabel, openInvites, type GroupSession } from '../../../domain/groupSessions';
import { joinGroupLocally } from '../../../data/groupSessionService';
import { useProviders } from '../../../ports/providersContext';
import { formatDateTime } from '../../../lib/storage';
import { storedUserId } from '../../badges/badgeStore';
import { groupErrorText } from './groupText';
import styles from './Group.module.css';
import sessionStyles from '../Sessions.module.css';

const t = de.groupSessions;

export function GroupInvites() {
  const { account } = useProviders();
  const navigate = useNavigate();
  const signedIn = account.enabled && !!storedUserId();
  const [invites, setInvites] = useState<GroupSession[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    account
      .myGroupSessions()
      .then((list) => live && setInvites(openInvites(list)))
      .catch(() => undefined); // ohne Verbindung keine Einladungen anzeigen – die Liste der Sessions bleibt nutzbar
    return () => {
      live = false;
    };
  }, [account, signedIn]);

  if (!signedIn || (invites.length === 0 && !error && !message)) return null;

  async function answer(g: GroupSession, accept: boolean) {
    setBusy(g.id);
    setError(undefined);
    setMessage(undefined);
    try {
      if (accept) {
        // erst lokal prüfen (läuft schon eine andere gemeinsame Session?), dann zusagen
        const local = await joinGroupLocally({ id: g.id, title: groupLabel(g) }).catch((e: unknown) => {
          throw (e as Error).name === 'GroupSessionBusyError' ? new Error(t.busy) : e;
        });
        await account.respondGroupInvite(g.id, true);
        navigate(`/fangbuch/sessions/${local.id}`);
        return;
      }
      await account.respondGroupInvite(g.id, false);
      setInvites((cur) => cur.filter((x) => x.id !== g.id));
      setMessage(t.declined);
    } catch (e) {
      setError(e instanceof Error && e.message === t.busy ? t.busy : groupErrorText(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section aria-labelledby="group-invites" className={`${sessionStyles.stack} ${styles.invites}`}>
      <h2 id="group-invites">{t.invitesTitle}</h2>
      {invites.map((g) => (
        <div key={g.id} className={styles.invite}>
          <p>
            <strong>{t.inviteFrom(g.hostDisplayName)}</strong>
          </p>
          <p className="muted">
            {[groupLabel(g), t.since(formatDateTime(g.startedAt))].filter(Boolean).join(' · ')}
          </p>
          <div className={sessionStyles.actions}>
            <Button disabled={busy === g.id} onClick={() => void answer(g, true)}>
              {t.accept}
            </Button>
            <Button variant="ghost" disabled={busy === g.id} onClick={() => void answer(g, false)}>
              {t.decline}
            </Button>
          </div>
        </div>
      ))}
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
