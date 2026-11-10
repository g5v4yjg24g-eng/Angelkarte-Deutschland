// Profil einer anderen Person (Paket 12, Masterprompt 5.1/6.1): Name, Abzeichen, Freundschaft; Text, Angaben und
// Highlights nur unter Freunden; Beiträge, soweit der Server sie freigibt (Freunde bzw. „Alle“). Alles kommt vom
// Server (user_profile, user_posts) – die App entscheidet nicht über Sichtbarkeit.
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { FeedIcon } from '../../design/icons';
import { friendErrorKind } from '../../domain/friends';
import type { PublicProfile } from '../../domain/userProfile';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { storedUserId } from '../badges/badgeStore';
import { FeedList } from '../feed/FeedPage';
import { SafetyMenu } from '../moderation/SafetyMenu';
import { Avatar } from './Avatar';
import { useAvatarUrl } from './avatarUrls';
import { ProfileFacts } from './ProfilePage';
import styles from './Profile.module.css';

const t = de.userProfile;

type State =
  { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'ready'; profile: PublicProfile };

export function UserProfilePage() {
  const { username = '' } = useParams();
  const { account } = useProviders();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const signedIn = !!storedUserId();
  const avatarUrl = useAvatarUrl(state.kind === 'ready' ? state.profile.userId : undefined);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    account
      .userProfile(username)
      .then((p) => live && setState(p ? { kind: 'ready', profile: p } : { kind: 'notFound' }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [account, username, signedIn, tick]);

  const userId = state.kind === 'ready' ? state.profile.userId : undefined;
  const loadPosts = useCallback(
    (before?: string) => (userId ? account.userPosts(userId, before) : Promise.resolve([])),
    [account, userId],
  );
  const highlightIds = state.kind === 'ready' ? state.profile.highlightPostIds : [];
  const highlightKey = highlightIds.join(',');
  const loadHighlights = useCallback(
    (before?: string) =>
      userId && highlightKey && !before
        ? account.userPosts(userId, undefined, highlightKey.split(',')).then((posts) => {
            const order = highlightKey.split(',');
            return [...posts].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
          })
        : Promise.resolve([]),
    [account, userId, highlightKey],
  );

  if (!signedIn)
    return (
      <Page title={t.title} back="/profil/freunde">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{de.friends.toAccount}</Link>
      </Page>
    );
  if (state.kind === 'loading')
    return (
      <Page title={t.title} back="/profil/freunde">
        <Notice>{t.loading}</Notice>
      </Page>
    );
  if (state.kind === 'notFound' || state.kind === 'error')
    return (
      <Page title={t.title} back="/profil/freunde">
        <Notice tone={state.kind === 'error' ? 'error' : 'info'}>
          {state.kind === 'error' ? t.error : t.notFound}
        </Notice>
      </Page>
    );

  const p = state.profile;
  if (p.relation === 'self') return <Navigate to="/profil" replace />;
  const isFriend = p.relation === 'friend';

  const act = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setError(undefined);
    try {
      setMessage(await fn());
      setTick((n) => n + 1);
    } catch (e) {
      setError(
        de.friends.errors[friendErrorKind(e instanceof AccountError || e instanceof Error ? e : undefined)],
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={p.displayName} back="/profil/freunde">
      <div className={styles.top}>
        <section className={styles.header} aria-label={t.title}>
          <Avatar url={avatarUrl} />
          <div className={styles.headMain}>
            <p className={styles.name}>{p.displayName}</p>
            <p className="muted">{de.friends.handle(p.username)}</p>
            {p.badges.includes('founder') && (
              <p className={styles.badgeRow}>
                <FounderBadge variant="full" />
              </p>
            )}
            <div className={styles.counts}>
              <span className={styles.count}>
                <strong>{p.friendCount.toLocaleString('de-DE')}</strong>
                <span>{t.friends}</span>
              </span>
            </div>
          </div>
        </section>
        {p.bio && <p className={styles.bio}>{p.bio}</p>}
        {isFriend && <ProfileFacts profile={p} />}
        <div className={styles.buttons}>
          {p.relation === 'none' && (
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const r = await account.sendFriendRequest(p.username);
                  return r === 'accepted' ? de.friends.nowFriends(p.username) : de.friends.sent(p.username);
                })
              }
            >
              {t.addFriend}
            </Button>
          )}
          {p.relation === 'incoming' && (
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await account.sendFriendRequest(p.username);
                  return de.friends.nowFriends(p.username);
                })
              }
            >
              {t.accept}
            </Button>
          )}
          {p.relation === 'outgoing' && (
            <Button variant="secondary" disabled>
              {t.requested}
            </Button>
          )}
          {isFriend && (
            <Button variant="secondary" disabled>
              {t.isFriend}
            </Button>
          )}
          <SafetyMenu
            kind="user"
            targetId={p.userId}
            owner={{ id: p.userId, name: p.displayName }}
            onDone={(m) => {
              setMessage(m);
              setTick((n) => n + 1);
            }}
          />
        </div>
        <p role="status" className="muted">
          {message}
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {!isFriend && <p className="muted">{t.friendsOnly}</p>}
      </div>

      {isFriend && highlightIds.length > 0 && (
        <Section title={t.highlightsTitle}>
          <FeedList load={loadHighlights} cursorOf={(x) => x.createdAt} empty={null} />
        </Section>
      )}
      <Section title={t.postsTitle}>
        <FeedList
          load={loadPosts}
          cursorOf={(x) => x.createdAt}
          empty={
            <EmptyState icon={<FeedIcon size={32} />} title={t.emptyTitle}>
              {t.emptyText}
            </EmptyState>
          }
        />
      </Section>
    </Page>
  );
}
