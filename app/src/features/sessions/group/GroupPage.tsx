// Gemeinsam angeln (/fangbuch/sessions/:id/gemeinsam, früher …/einladen): Teilnehmer als Visitenkarten mit Stand
// (dabei, eingeladen, abgelehnt …) und ihren erreichten Erfolgen, Freunde hinzufügen (nur Gastgeber, nur Freunde,
// höchstens 10 Personen), verlassen und Highlights. Ohne gemeinsame Session wird sie beim ersten Einladen angelegt
// und mit der eigenen verknüpft. Nur mit Konto; die Teilnehmerliste fragt alle 15 s nach.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { VisitCard, type VisitTone } from '../../../design/components/VisitCard';
import { getDb } from '../../../data/db';
import { linkGroup } from '../../../data/groupSessionService';
import type { FriendEntry } from '../../../domain/friends';
import { freeSlots, invitableFriends, type GroupMember } from '../../../domain/groupSessions';
import { initialOf } from '../../../domain/feed';
import { isRunning } from '../../../domain/session';
import { useProviders } from '../../../ports/providersContext';
import { AchievementMedals } from '../../achievements/AchievementMedals';
import { useAchievements } from '../../achievements/useAchievements';
import { storedUserId } from '../../badges/badgeStore';
import { FeedList } from '../../feed/FeedPage';
import { Avatar } from '../../profile/Avatar';
import { useAvatarUrls } from '../../profile/avatarUrls';
import { useProfile } from '../../profile/usePhoto';
import { groupErrorText } from './groupText';
import { useGroupMembers } from './useGroupMembers';
import { useMemberAchievements } from './useMemberAchievements';
import styles from './Group.module.css';
import sessionStyles from '../Sessions.module.css';

const t = de.groupSessions;

const ORDER: Record<GroupMember['status'], number> = { joined: 0, invited: 1, left: 2, declined: 3 };
const sorted = (members: readonly GroupMember[]) =>
  [...members].sort(
    (a, b) =>
      Number(b.isHost) - Number(a.isHost) ||
      ORDER[a.status] - ORDER[b.status] ||
      a.displayName.localeCompare(b.displayName, 'de'),
  );

const TONE: Record<GroupMember['status'], VisitTone> = {
  joined: 'success',
  invited: 'waiting',
  declined: 'danger',
  left: 'muted',
};

export function GroupPage() {
  const { id = '' } = useParams();
  const { account } = useProviders();
  const me = storedUserId();
  const signedIn = account.enabled && !!me;
  const session = useLiveQuery(async () => (await getDb().sessions.get(id)) ?? null, [id]);
  const groupId = session?.groupId;
  const { members, failed, reload } = useGroupMembers(groupId, true);
  const [friends, setFriends] = useState<FriendEntry[]>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shareWater, setShareWater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const back = `/fangbuch/sessions/${id}`;
  const running = !!session && !session.deletedAt && isRunning(session);
  const mine = members?.find((m) => m.userId === me);
  const isHost = !groupId || !!mine?.isHost;
  const participant = !!mine && (mine.status === 'joined' || mine.status === 'left' || mine.isHost);

  const myProfile = useProfile();
  const myAchievements = useAchievements();
  const others = (members ?? []).filter((m) => m.userId !== me).map((m) => m.userId);
  const achievements = useMemberAchievements(others);
  const avatars = useAvatarUrls((members ?? []).map((m) => m.userId));

  // Freunde zum Einladen: nur nötig, solange ich einladen darf
  useEffect(() => {
    if (!signedIn || !running || !isHost) return;
    let live = true;
    account
      .friends()
      .then((f) => live && setFriends(f))
      .catch(() => live && setError(t.loadError));
    return () => {
      live = false;
    };
  }, [account, signedIn, running, isHost]);

  const loadHighlights = useCallback(
    (before?: string) => (groupId ? account.groupHighlights(groupId, before) : Promise.resolve([])),
    [account, groupId],
  );

  if (!signedIn)
    return (
      <Page title={t.title} back={back}>
        <Notice>{t.signedOut}</Notice>
      </Page>
    );
  if (session === undefined)
    return (
      <Page title={t.title} back={back}>
        <p className="muted">{t.loading}</p>
      </Page>
    );
  if (!session || session.deletedAt)
    return (
      <Page title={t.title} back={back}>
        <Notice>{de.sessions.notFound}</Notice>
      </Page>
    );

  const candidates = friends ? invitableFriends(friends, members ?? []) : [];
  const slots = freeSlots(members ?? []);
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
    setMessage(undefined);
    try {
      let gid = groupId;
      if (!gid) {
        gid = await account.createGroupSession({
          title: session.title,
          waterName: shareWater ? waterName : undefined,
        });
        await linkGroup(session.id, gid);
      }
      const n = picked.size;
      await account.inviteToGroupSession(gid, [...picked]);
      setPicked(new Set());
      setMessage(t.invited(n));
      reload();
    } catch (e) {
      setError(groupErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!groupId) return;
    setError(undefined);
    try {
      await account.leaveGroupSession(groupId);
      await linkGroup(session?.id ?? id, undefined);
      setMessage(t.left);
    } catch (e) {
      setError(groupErrorText(e));
    }
  }

  return (
    <Page title={t.title} back={back}>
      <div className={sessionStyles.stack}>
        {!groupId && <p className="muted">{t.intro}</p>}
        {groupId && !members && !failed && <p className="muted">{t.loading}</p>}
        {failed && <Notice tone="error">{t.loadError}</Notice>}
        {members && members.length > 0 && (
          <ul className={styles.cards} aria-label={t.members}>
            {sorted(members).map((m) => {
              const isMe = m.userId === me;
              const unlocked = isMe ? myAchievements?.unlocked : achievements.get(m.userId);
              return (
                <li key={m.userId}>
                  <VisitCard
                    label={m.displayName}
                    avatar={
                      isMe && myProfile?.avatarPhotoId ? (
                        <Avatar photoId={myProfile.avatarPhotoId} size={64} />
                      ) : avatars.get(m.userId) ? (
                        <Avatar url={avatars.get(m.userId)} size={64} />
                      ) : (
                        <span className={styles.initial} aria-hidden="true">
                          {initialOf(m.displayName)}
                        </span>
                      )
                    }
                    name={m.displayName}
                    handle={`@${m.username}${isMe ? ` · ${t.you}` : ''}`}
                    detail={unlocked ? <AchievementMedals unlocked={unlocked} /> : undefined}
                    status={
                      m.isHost
                        ? { label: t.cardHost, tone: 'success' }
                        : { label: t.cardStatus[m.status], tone: TONE[m.status] }
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {groupId && members && members.length === 0 && <p className="muted">{t.nobody}</p>}

        {running && isHost && (
          <Section title={t.addTitle}>
            <div className={sessionStyles.stack}>
              {!friends && !error && <p className="muted">{t.loading}</p>}
              {friends && candidates.length === 0 && (
                <>
                  <Notice>{t.noFriends}</Notice>
                  <Link to="/profil/freunde">{t.toFriends}</Link>
                </>
              )}
              {friends && candidates.length > 0 && (
                <>
                  <p role="status">{slots > 0 ? t.slotsLeft(Math.max(0, slots - picked.size)) : t.full}</p>
                  <fieldset className={styles.picks}>
                    <legend className="visually-hidden">{t.addTitle}</legend>
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
                      {busy ? t.sending : picked.size === 0 ? t.inviteIdle : t.sendInvites(picked.size)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Section>
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
        {groupId && participant && (
          <section aria-labelledby="group-highlights" className={sessionStyles.stack}>
            <h3 id="group-highlights">{t.highlights}</h3>
            <FeedList
              load={loadHighlights}
              cursorOf={(p) => p.createdAt}
              empty={<p className="muted">{t.noHighlights}</p>}
            />
          </section>
        )}
      </div>
    </Page>
  );
}
