// Feed (Etappe 3, Wunsch Nutzer 2026-11-03): geteilte Beiträge von Freunden und eigene, neueste zuerst.
// Nur angemeldet – sonst kein Netz und ein Hinweis aufs Konto.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { FeedIcon, RefreshIcon } from '../../design/icons';
import { IconButton } from '../../design/components/Button';
import { hasMore, initialOf, mergeFeed, type FeedPost } from '../../domain/feed';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { storedUserId } from '../badges/badgeStore';
import { Toast } from '../../design/components/Toast';
import { isHidden } from '../../domain/moderation';
import { SafetyMenu } from '../moderation/SafetyMenu';
import type { ServerReactions } from '../../domain/reactions';
import { ReactionBar } from '../reactions/ReactionBar';
import { ServerCommentsSheet } from '../reactions/ServerCommentsSheet';
import { useServerReactions } from '../reactions/useServerReactions';
import { useHidden } from '../moderation/hiddenStore';
import { useAvatarUrls } from '../profile/avatarUrls';
import { usePikeLike } from '../reactions/usePikeLike';
import { useHaptics } from '../haptics/useHaptics';
import styles from './Feed.module.css';

const t = de.feed;
const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });

function FeedCard({
  post,
  onDone,
  reactions,
  onLike,
  onCommentCount,
  avatarUrl,
}: {
  post: FeedPost;
  onDone: (message: string) => void;
  reactions: ServerReactions;
  onLike: () => void;
  onCommentCount: (delta: number) => void;
  avatarUrl?: string | undefined;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const likeIconRef = useRef<HTMLSpanElement>(null);
  const haptics = useHaptics();
  // Doppeltipp aufs Foto: Hecht schwimmt zum Daumen und setzt „Gefällt mir“ (nie zurücknehmen)
  const pike = usePikeLike({
    frame: frameRef,
    canvas: canvasRef,
    target: likeIconRef,
    liked: reactions.liked,
    onLike,
    onArrive: () => {
      setPulse((n) => n + 1);
      haptics.light();
    },
  });
  const total = post.photoUrls.length;
  return (
    <article className={styles.card} aria-label={t.postLabel(post.displayName, dateOf(post.createdAt))}>
      <header className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initialOf(post.displayName)}
        </span>
        <span className={styles.who}>
          <strong>
            {post.displayName}
            {post.badges.includes('founder') && <FounderBadge />}
          </strong>
          <span className="muted">
            {t.handle(post.username)} · {dateOf(post.createdAt)}
          </span>
        </span>
        {post.authorId !== storedUserId() && (
          <span className={styles.menu}>
            <SafetyMenu
              kind="post"
              targetId={post.id}
              owner={{ id: post.authorId, name: post.displayName }}
              onDone={onDone}
            />
          </span>
        )}
      </header>
      <div className={styles.photoFrame} ref={frameRef}>
        <ul
          {...pike.handlers}
          className={styles.photos}
          aria-label={t.photos(post.displayName)}
          tabIndex={0}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {post.photoUrls.map((url, i) => (
            <li key={post.photoPaths[i] ?? i} aria-roledescription="slide" aria-label={t.photo(i + 1, total)}>
              {url ? (
                <img src={url} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className={styles.missing}>{t.photoMissing}</span>
              )}
            </li>
          ))}
        </ul>
        <canvas ref={canvasRef} className={styles.pikeLayer} aria-hidden="true" />
      </div>
      {total > 1 && (
        <div className={styles.dots} aria-hidden="true">
          {post.photoUrls.map((_, i) => (
            <span key={i} className={i === index ? styles.dotOn : styles.dot} />
          ))}
        </div>
      )}
      {post.caption && (
        <p className={styles.caption}>
          <strong>{post.displayName}</strong> {post.caption}
        </p>
      )}
      <ReactionBar
        likeCount={reactions.likeCount}
        commentCount={reactions.commentCount}
        liked={reactions.liked}
        onLike={onLike}
        onComments={() => setCommentsOpen(true)}
        likeIconRef={likeIconRef}
        pulse={pulse}
      />
      <ServerCommentsSheet
        open={commentsOpen}
        postId={post.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={onCommentCount}
      />
    </article>
  );
}

/** Gemeldete Beiträge und Beiträge gemeldeter/blockierter Konten fallen weg */
const visible = (posts: readonly FeedPost[], hidden: ReadonlySet<string>) =>
  posts.filter((p) => !isHidden(hidden, 'post', p.id, p.authorId));

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; posts: FeedPost[]; more: boolean; loadingMore: boolean };

export function FeedPage() {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const hidden = useHidden();
  const [toast, setToast] = useState<string>();
  const ids = state.kind === 'ready' ? state.posts.map((p) => p.id) : [];
  const reactions = useServerReactions(ids, signedIn);
  const avatars = useAvatarUrls(state.kind === 'ready' ? state.posts.map((p) => p.authorId) : []);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    account
      .feed()
      .then((posts) => live && setState({ kind: 'ready', posts, more: hasMore(posts), loadingMore: false }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [account, signedIn, tick]);

  const loadMore = async () => {
    if (state.kind !== 'ready') return;
    const last = state.posts.at(-1);
    setState({ ...state, loadingMore: true });
    try {
      const next = await account.feed(last?.createdAt);
      setState({
        kind: 'ready',
        posts: mergeFeed(state.posts, next),
        more: hasMore(next),
        loadingMore: false,
      });
    } catch {
      setState({ ...state, loadingMore: false });
    }
  };

  if (!signedIn)
    return (
      <Page title={t.title}>
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  return (
    <Page title={t.title} action={<IconButton label={t.refresh} icon={<RefreshIcon />} onClick={refresh} />}>
      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && (
        <>
          <Notice tone="error">{t.error}</Notice>
          <div>
            <Button variant="secondary" onClick={refresh}>
              {t.retry}
            </Button>
          </div>
        </>
      )}
      {state.kind === 'ready' &&
        (visible(state.posts, hidden).length === 0 ? (
          <EmptyState
            icon={<FeedIcon size={32} />}
            title={t.emptyTitle}
            action={
              <Link to="/profil/freunde" className={styles.linkButton}>
                {t.addFriends}
              </Link>
            }
          >
            {t.emptyText}
          </EmptyState>
        ) : (
          <div className={styles.list}>
            {visible(state.posts, hidden).map((p) => (
              <FeedCard
                key={p.id}
                post={p}
                onDone={setToast}
                reactions={reactions.get(p.id)}
                onLike={() => reactions.toggle(p.id)}
                onCommentCount={(d) => reactions.addComments(p.id, d)}
                avatarUrl={avatars.get(p.authorId)}
              />
            ))}
            {state.more ? (
              <div>
                <Button variant="secondary" disabled={state.loadingMore} onClick={() => void loadMore()}>
                  {state.loadingMore ? t.loading : t.more}
                </Button>
              </div>
            ) : (
              <p className="muted">{t.end}</p>
            )}
          </div>
        ))}
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
      {reactions.error && <Toast onDismiss={reactions.clearError}>{reactions.error}</Toast>}
    </Page>
  );
}
