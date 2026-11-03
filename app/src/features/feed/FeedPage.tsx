// Feed (Etappe 3, Wunsch Nutzer 2026-11-03): geteilte Beiträge von Freunden und eigene, neueste zuerst.
// Nur angemeldet – sonst kein Netz und ein Hinweis aufs Konto.
import { useCallback, useEffect, useState } from 'react';
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
import { useHidden } from '../moderation/hiddenStore';
import styles from './Feed.module.css';

const t = de.feed;
const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });

function FeedCard({ post, onDone }: { post: FeedPost; onDone: (message: string) => void }) {
  const [index, setIndex] = useState(0);
  const total = post.photoUrls.length;
  return (
    <article className={styles.card} aria-label={t.postLabel(post.displayName, dateOf(post.createdAt))}>
      <header className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {initialOf(post.displayName)}
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
      <ul
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
              <FeedCard key={p.id} post={p} onDone={setToast} />
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
    </Page>
  );
}
