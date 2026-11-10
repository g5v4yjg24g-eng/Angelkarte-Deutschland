// Profil einer anderen Person (Paket 12, Masterprompt 5.1/6.1): Name, Abzeichen, Freundschaft; Text, Angaben und
// Highlights nur unter Freunden; Beiträge, soweit der Server sie freigibt (Freunde bzw. „Alle“). Alles kommt vom
// Server (user_profile, user_posts) – die App entscheidet nicht über Sichtbarkeit.
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { FeedIcon, ImagesIcon } from '../../design/icons';
import { friendErrorKind } from '../../domain/friends';
import type { PublicProfile } from '../../domain/userProfile';
import { FEED_PAGE, type FeedPost } from '../../domain/feed';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import type { RemoteAchievements } from '../../domain/sharedAchievements';
import { AchievementCard } from '../achievements/AchievementCard';
import { FounderBadge } from '../badges/FounderBadge';
import { storedUserId } from '../badges/badgeStore';
import { SafetyMenu } from '../moderation/SafetyMenu';
import { Avatar } from './Avatar';
import { useAvatarUrl } from './avatarUrls';
import { userPostsLink } from './userPostsLink';
import { ProfileFacts } from './ProfilePage';
import styles from './Profile.module.css';

const t = de.userProfile;

interface PostState {
  list: FeedPost[];
  more: boolean;
  loading: boolean;
  error?: boolean;
}

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
  // Beiträge als Kacheln (wie das eigene Profil, Wunsch Nutzer 2026-11-10); weitere Seiten auf Knopfdruck
  const [posts, setPosts] = useState<PostState>();
  useEffect(() => {
    if (!userId) return;
    let live = true;
    account
      .userPosts(userId)
      .then((list) => live && setPosts({ list, more: list.length >= FEED_PAGE, loading: false }))
      .catch(() => live && setPosts({ list: [], more: false, loading: false, error: true }));
    return () => {
      live = false;
    };
  }, [account, userId, tick]);
  const loadMore = useCallback(async () => {
    const last = posts?.list.at(-1);
    if (!userId || !posts || !last) return;
    setPosts({ ...posts, loading: true });
    try {
      const next = await account.userPosts(userId, last.createdAt);
      setPosts({ list: [...posts.list, ...next], more: next.length >= FEED_PAGE, loading: false });
    } catch {
      setPosts({ ...posts, loading: false, error: true });
    }
  }, [account, userId, posts]);
  // Erfolge (Paket B): nur, wenn die Person sie freigegeben hat – sonst erscheint nichts
  const [achievements, setAchievements] = useState<RemoteAchievements>();
  useEffect(() => {
    if (!userId) return;
    let live = true;
    account
      .userAchievements(userId)
      .then((a) => live && setAchievements(a))
      .catch(() => live && setAchievements({ visible: false }));
    return () => {
      live = false;
    };
  }, [account, userId, tick]);
  const highlightKey = state.kind === 'ready' ? state.profile.highlightPostIds.join(',') : '';
  const [highlights, setHighlights] = useState<FeedPost[]>([]);
  useEffect(() => {
    if (!userId || !highlightKey) return;
    let live = true;
    const order = highlightKey.split(',');
    account
      .userPosts(userId, undefined, order)
      .then(
        (list) => live && setHighlights([...list].sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))),
      )
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [account, userId, highlightKey]);

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
                <strong>
                  {posts ? `${posts.list.length.toLocaleString('de-DE')}${posts.more ? '+' : ''}` : t.noCount}
                </strong>
                <span>{t.postsTitle}</span>
              </span>
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

      {achievements?.visible && <AchievementCard id="user-achievements" unlocked={achievements.unlocked} />}
      {isFriend && highlights.length > 0 && (
        <section className={styles.highlights} aria-labelledby="user-highlights">
          <h2 id="user-highlights">{t.highlightsTitle}</h2>
          <ul className={styles.highlightRow}>
            {highlights.map((x) => (
              <RemoteTile key={x.id} post={x} n={(posts?.list.indexOf(x) ?? -1) + 1} username={p.username} />
            ))}
          </ul>
        </section>
      )}
      <PostGrid username={p.username} posts={posts} onMore={() => void loadMore()} />
    </Page>
  );
}

function RemoteTile({ post, n, username }: { post: FeedPost; n: number; username: string }) {
  const url = post.photoUrls[0];
  return (
    <li>
      <Link
        to={userPostsLink(username, post)}
        className={styles.tile}
        aria-label={de.profile.openPost(n, post.caption)}
      >
        {url && <img src={url} alt="" loading="lazy" decoding="async" />}
        {post.photoPaths.length > 1 && (
          <span className={styles.multi} title={de.profile.multiPhoto}>
            <ImagesIcon size={18} />
          </span>
        )}
      </Link>
    </li>
  );
}

function PostGrid({
  username,
  posts,
  onMore,
}: {
  username: string;
  posts: PostState | undefined;
  onMore: () => void;
}) {
  if (!posts) return <p className="muted">{t.loading}</p>;
  if (posts.list.length === 0)
    return posts.error ? (
      <Notice tone="error">{t.error}</Notice>
    ) : (
      <EmptyState icon={<FeedIcon size={32} />} title={t.emptyTitle}>
        {t.emptyText}
      </EmptyState>
    );
  return (
    <>
      <ul className={styles.grid} aria-label={t.gridLabel}>
        {posts.list.map((x, i) => (
          <RemoteTile key={x.id} post={x} n={i + 1} username={username} />
        ))}
      </ul>
      {posts.error && <Notice tone="error">{t.error}</Notice>}
      {posts.more && (
        <Button variant="secondary" disabled={posts.loading} onClick={onMore}>
          {t.more}
        </Button>
      )}
    </>
  );
}
