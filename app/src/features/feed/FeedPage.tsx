// Feed (Etappe 3, Wunsch Nutzer 2026-11-03): geteilte Beiträge von Freunden und eigene, neueste zuerst.
// Reiter „Entdecken“ (Paket 7c): Beiträge mit „Alle“ von anderen Konten, zuletzt geteilt zuerst.
// Nur angemeldet – sonst kein Netz und ein Hinweis aufs Konto.
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { FeedIcon } from '../../design/icons';
import { TabLinks } from '../../design/components/TabLinks';
import { hasMore, initialOf, type FeedPost } from '../../domain/feed';
import { useProviders } from '../../ports/providersContext';
import { mergeHandlers, useSwipeCarousel } from '../../lib/useSwipeCarousel';
import { usePullToRefresh } from '../../lib/usePullToRefresh';
import { PullIndicator } from './PullIndicator';
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
import { CatchTag } from '../profile/CatchInfoFields';
import { useSaves } from './useSaves';
import { NotificationsButton } from '../notifications/NotificationsButton';
import { nextAnchors } from '../../domain/suggestions';
import { SuggestCarousel } from '../suggestions/SuggestCarousel';
import { useSuggestions } from '../suggestions/useSuggestions';
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
  saved,
  onSave,
}: {
  post: FeedPost;
  onDone: (message: string) => void;
  reactions: ServerReactions;
  onLike: () => void;
  onCommentCount: (delta: number) => void;
  avatarUrl?: string | undefined;
  saved: boolean;
  onSave: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
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
  const swipe = useSwipeCarousel(listRef, total);
  return (
    <article className={styles.card} aria-label={t.postLabel(post.displayName, dateOf(post.createdAt))}>
      <header className={styles.head}>
        {/* Profilbild öffnet wie der Name das Profil (Wunsch Nutzer 2026-11-10); für Tastatur/Screenreader reicht
            der Namens-Link, deshalb hier kein zweiter Halt */}
        <Link
          to={`/profil/nutzer/${post.username}`}
          className={styles.avatarLink}
          tabIndex={-1}
          aria-hidden="true"
        >
          <span className={styles.avatar}>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initialOf(post.displayName)}
          </span>
        </Link>
        <span className={styles.who}>
          <strong>
            <Link to={`/profil/nutzer/${post.username}`} className={styles.authorLink}>
              {post.displayName}
            </Link>
            {post.badges.includes('founder') && <FounderBadge />}
          </strong>
          <CatchTag speciesId={post.speciesId} lengthCm={post.lengthCm} variant="line" />
          <span className="muted">
            {t.handle(post.username)} · {dateOf(post.createdAt)}
          </span>
          {post.groupId && <span className={styles.highlightTag}>{t.highlight(post.groupTitle)}</span>}
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
          ref={listRef}
          {...mergeHandlers(pike.handlers, swipe)}
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
        saved={saved}
        onSave={onSave}
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

/**
 * Liste von Beiträgen mit „Gefällt mir“, Kommentaren, Lesezeichen und Nachladen – gemeinsam für den Feed und
 * „Gespeichert“ (Paket 7b). `load(before)` liefert eine Seite; `cursorOf` den Wert für die nächste.
 */
export function FeedList({
  load,
  cursorOf,
  empty,
  reloadKey = 0,
  onSettled,
  suggestions = false,
}: {
  load: (before?: string) => Promise<FeedPost[]>;
  cursorOf: (p: FeedPost) => string;
  empty: ReactNode;
  reloadKey?: number;
  /** Das (Neu-)Laden ist fertig – mit Erfolg oder Fehler */
  onSettled?: () => void;
  /** „Angler entdecken“ zwischen den Beiträgen (nur im Feed „Gefolgt“) */
  suggestions?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  });
  const hidden = useHidden();
  const [toast, setToast] = useState<string>();
  const ids = state.kind === 'ready' ? state.posts.map((p) => p.id) : [];
  const reactions = useServerReactions(ids, true);
  const saves = useSaves(ids);
  const avatars = useAvatarUrls(state.kind === 'ready' ? state.posts.map((p) => p.authorId) : []);
  // Profilvorschläge: erst nach dem ersten Laden des Feeds anfragen; die Plätze zwischen den Beiträgen bleiben fest
  const sug = useSuggestions(suggestions && state.kind === 'ready');
  const shown = state.kind === 'ready' ? visible(state.posts, hidden) : [];
  const [anchors, setAnchors] = useState<number[]>([]);
  const carouselCount = sug.carousels.length;
  // ein einmal gesetzter Platz ändert sich nie; neue kommen nur dazu (Stand direkt beim Zeichnen angepasst)
  const grown = nextAnchors(anchors, shown.length, carouselCount);
  if (grown.length !== anchors.length) setAnchors(grown);
  const carouselAt = (count: number) => {
    const i = anchors.indexOf(count);
    const list = i >= 0 ? sug.carousels[i] : undefined;
    return list ? (
      <SuggestCarousel
        id={`suggest-${i}`}
        list={list}
        followState={sug.followState}
        onFollow={sug.follow}
        onDismiss={sug.dismiss}
      />
    ) : null;
  };

  useEffect(() => {
    let live = true;
    load()
      .then((posts) => live && setState({ kind: 'ready', posts, more: hasMore(posts), loadingMore: false }))
      .catch(() => live && setState({ kind: 'error' }))
      .finally(() => live && settled.current?.());
    return () => {
      live = false;
    };
  }, [load, tick, reloadKey]);

  const loadMore = async () => {
    if (state.kind !== 'ready') return;
    const last = state.posts.at(-1);
    setState({ ...state, loadingMore: true });
    try {
      const next = await load(last ? cursorOf(last) : undefined);
      setState({
        kind: 'ready',
        posts: [...state.posts, ...next.filter((n) => !state.posts.some((p) => p.id === n.id))],
        more: hasMore(next),
        loadingMore: false,
      });
    } catch {
      setState({ ...state, loadingMore: false });
    }
  };

  return (
    <>
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
        (shown.length === 0 ? (
          <>
            {empty}
            {suggestions && sug.carousels[0] && (
              <SuggestCarousel
                id="suggest-0"
                list={sug.carousels[0]}
                followState={sug.followState}
                onFollow={sug.follow}
                onDismiss={sug.dismiss}
              />
            )}
          </>
        ) : (
          <div className={styles.list}>
            {shown.map((p, i) => (
              <Fragment key={p.id}>
                <FeedCard
                  post={p}
                  onDone={setToast}
                  reactions={reactions.get(p.id)}
                  onLike={() => reactions.toggle(p.id)}
                  onCommentCount={(d) => reactions.addComments(p.id, d)}
                  avatarUrl={avatars.get(p.authorId)}
                  saved={saves.isSaved(p.id)}
                  onSave={() => saves.toggle(p.id)}
                />
                {suggestions && carouselAt(i + 1)}
              </Fragment>
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
      {sug.message && <Toast onDismiss={sug.clearMessage}>{sug.message}</Toast>}
      {reactions.error && <Toast onDismiss={reactions.clearError}>{reactions.error}</Toast>}
      {saves.error && <Toast onDismiss={saves.clearError}>{saves.error}</Toast>}
    </>
  );
}

/** Reiter „Freunde | Entdecken“ (Paket 7c) */
function FeedTabs() {
  return (
    <TabLinks
      label={t.tabsLabel}
      tabs={[
        { to: '/feed', label: t.tabFriends },
        { to: '/feed/entdecken', label: t.tabDiscover },
      ]}
    />
  );
}

export function FeedPage({ mode = 'friends' }: { mode?: 'friends' | 'discover' }) {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [tick, setTick] = useState(0);
  // Aktualisieren durch Ziehen: wartet, bis die Liste neu geladen ist (mindestens kurz sichtbar)
  const settle = useRef<(() => void) | undefined>(undefined);
  const pull = usePullToRefresh(
    () =>
      new Promise<void>((resolve) => {
        const started = Date.now();
        const timer = window.setTimeout(resolve, 8000);
        settle.current = () => {
          settle.current = undefined;
          window.clearTimeout(timer);
          window.setTimeout(resolve, Math.max(0, 600 - (Date.now() - started)));
        };
        setTick((n) => n + 1);
      }),
    account.enabled && !!storedUserId(),
  );
  const load = useCallback(
    (before?: string) => (mode === 'discover' ? account.discoverFeed(before) : account.feed(before)),
    [account, mode],
  );

  if (!signedIn)
    return (
      <Page title={t.title}>
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  return (
    <Page
      title={t.title}
      action={
        <span className={styles.headActions}>
          <NotificationsButton />
        </span>
      }
    >
      <FeedTabs />
      <PullIndicator offset={pull.offset} state={pull.state} />
      <FeedList
        key={mode}
        onSettled={() => settle.current?.()}
        load={load}
        cursorOf={(p) => (mode === 'discover' ? (p.sharedAt ?? p.createdAt) : p.createdAt)}
        reloadKey={tick}
        suggestions={mode === 'friends'}
        empty={
          mode === 'discover' ? (
            <EmptyState icon={<FeedIcon size={32} />} title={t.discoverEmptyTitle}>
              {t.discoverEmptyText}
            </EmptyState>
          ) : (
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
          )
        }
      />
    </Page>
  );
}
