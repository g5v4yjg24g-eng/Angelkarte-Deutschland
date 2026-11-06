// Freunde zu einer Session einladen (Paket 8a, /fangbuch/sessions/:id/einladen). Nur Freunde, höchstens 10 Personen.
// Ohne gemeinsame Session wird sie beim ersten Einladen angelegt und mit der eigenen verknüpft.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { getDb } from '../../../data/db';
import { linkGroup } from '../../../data/groupSessionService';
import type { FriendEntry } from '../../../domain/friends';
import {
  freeSlots,
  invitableFriends,
  MAX_GROUP_MEMBERS,
  type GroupMember,
} from '../../../domain/groupSessions';
import { initialOf } from '../../../domain/feed';
import { isRunning } from '../../../domain/session';
import { useProviders } from '../../../ports/providersContext';
import { storedUserId } from '../../badges/badgeStore';
import { groupErrorText } from './groupText';
import styles from './Group.module.css';
import sessionStyles from '../Sessions.module.css';

const t = de.groupSessions;

export function InvitePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const session = useLiveQuery(async () => (await getDb().sessions.get(id)) ?? null, [id]);
  const [data, setData] = useState<{ friends: FriendEntry[]; members: GroupMember[] }>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shareWater, setShareWater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const groupId = session?.groupId;
  const back = `/fangbuch/sessions/${id}`;

  useEffect(() => {
    if (!signedIn || session === undefined) return;
    let live = true;
    Promise.all([account.friends(), groupId ? account.groupSessionMembers(groupId) : Promise.resolve([])])
      .then(([friends, members]) => live && setData({ friends, members }))
      .catch(() => live && setError(t.loadError));
    return () => {
      live = false;
    };
  }, [account, signedIn, session, groupId]);

  if (!signedIn)
    return (
      <Page title={t.inviteTitle} back={back}>
        <Notice>{t.signedOut}</Notice>
      </Page>
    );
  if (session === undefined)
    return (
      <Page title={t.inviteTitle} back={back}>
        <p className="muted">{t.loading}</p>
      </Page>
    );
  if (!session || session.deletedAt || !isRunning(session))
    return (
      <Page title={t.inviteTitle} back={back}>
        <Notice>{session ? t.notRunning : de.sessions.notFound}</Notice>
      </Page>
    );

  const candidates = data ? invitableFriends(data.friends, data.members) : [];
  const slots = data ? freeSlots(data.members) : MAX_GROUP_MEMBERS - 1;
  const waterName = session.waterSnapshot?.name;

  function toggle(userId: string, on: boolean) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  async function send() {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      let gid = groupId;
      if (!gid) {
        gid = await account.createGroupSession({
          title: session.title,
          waterName: shareWater ? waterName : undefined,
        });
        await linkGroup(session.id, gid);
      }
      await account.inviteToGroupSession(gid, [...picked]);
      navigate(back);
    } catch (e) {
      setError(groupErrorText(e));
      setBusy(false);
    }
  }

  return (
    <Page title={t.inviteTitle} back={back}>
      <div className={sessionStyles.stack}>
        <p className="muted">{t.inviteIntro(MAX_GROUP_MEMBERS)}</p>
        {!data && !error && <p className="muted">{t.loading}</p>}
        {data && candidates.length === 0 && (
          <>
            <Notice>{t.noFriends}</Notice>
            <Link to="/profil/freunde">{t.toFriends}</Link>
          </>
        )}
        {data && candidates.length > 0 && (
          <>
            <p role="status">{slots > 0 ? t.slotsLeft(Math.max(0, slots - picked.size)) : t.full}</p>
            <fieldset className={styles.picks}>
              <legend className="visually-hidden">{t.inviteTitle}</legend>
              {candidates.map((f) => {
                const on = picked.has(f.userId);
                return (
                  <label key={f.userId} className={styles.pick}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && picked.size >= slots}
                      onChange={(e) => toggle(f.userId, e.target.checked)}
                    />
                    <span className={styles.avatar} aria-hidden="true">
                      {initialOf(f.displayName)}
                    </span>
                    <span className={styles.who}>
                      <strong>{f.displayName}</strong>
                      <span className="muted">@{f.username}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {!groupId && waterName && (
              <label className={styles.pick}>
                <input
                  type="checkbox"
                  checked={shareWater}
                  onChange={(e) => setShareWater(e.target.checked)}
                />
                <span className={styles.who}>
                  <span>{t.shareWater(waterName)}</span>
                  <span className="muted">{t.shareWaterHint}</span>
                </span>
              </label>
            )}
            <div className={sessionStyles.actions}>
              <Button disabled={busy || picked.size === 0} onClick={() => void send()}>
                {busy ? t.sending : t.sendInvites(picked.size)}
              </Button>
            </div>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Page>
  );
}
