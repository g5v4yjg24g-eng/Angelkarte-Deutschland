// Gemeinsame Session in der Session-Ansicht (Paket 8a): einladen, Teilnehmer sehen, verlassen.
// Nur angemeldet; ohne Verknüpfung und nach dem Ende ohne Einladen.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { de } from '../../../i18n/de';
import { Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { initialOf } from '../../../domain/feed';
import type { GroupMember } from '../../../domain/groupSessions';
import type { Session } from '../../../domain/schemas';
import { isRunning } from '../../../domain/session';
import { useProviders } from '../../../ports/providersContext';
import { linkGroup } from '../../../data/groupSessionService';
import { storedUserId } from '../../badges/badgeStore';
import { groupErrorText } from './groupText';
import styles from './Group.module.css';
import sessionStyles from '../Sessions.module.css';

const t = de.groupSessions;

export function GroupSection({ session }: { session: Session }) {
  const { account } = useProviders();
  const navigate = useNavigate();
  const me = storedUserId();
  const signedIn = account.enabled && !!me;
  const running = isRunning(session);
  const groupId = session.groupId;
  const [members, setMembers] = useState<GroupMember[]>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!signedIn || !groupId) return;
    let live = true;
    account
      .groupSessionMembers(groupId)
      .then((m) => live && setMembers(m))
      .catch(() => live && setError(t.loadError));
    return () => {
      live = false;
    };
  }, [account, signedIn, groupId]);

  if (!signedIn || (!groupId && !running)) return null;

  const mine = members?.find((m) => m.userId === me);
  const isHost = !groupId || !!mine?.isHost;

  async function leave() {
    if (!groupId) return;
    setError(undefined);
    try {
      await account.leaveGroupSession(groupId);
      await linkGroup(session.id, undefined);
      setMessage(t.left);
    } catch (e) {
      setError(groupErrorText(e));
    }
  }

  return (
    <Section title={t.title}>
      <div className={sessionStyles.stack}>
        {!groupId && <p className="muted">{t.intro}</p>}
        {groupId && !members && !error && <p className="muted">{t.loading}</p>}
        {members && (
          <ul className={styles.members} aria-label={t.members}>
            {members.map((m) => (
              <li key={m.userId} className={styles.member}>
                <span className={styles.avatar} aria-hidden="true">
                  {initialOf(m.displayName)}
                </span>
                <span className={styles.who}>
                  <strong>
                    {m.displayName}
                    {m.userId === me && ` (${t.you})`}
                  </strong>
                  <span className="muted">
                    @{m.username} · {m.isHost ? t.host : t.status[m.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {running && isHost && (
          <div className={sessionStyles.actions}>
            <Button variant="secondary" onClick={() => navigate(`/fangbuch/sessions/${session.id}/einladen`)}>
              {groupId ? t.inviteMore : t.invite}
            </Button>
          </div>
        )}
        {groupId && mine && !mine.isHost && (
          <div className={sessionStyles.actions}>
            <Button variant="ghost" onClick={() => void leave()}>
              {t.leave}
            </Button>
          </div>
        )}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Section>
  );
}
