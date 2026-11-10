// Eigene Beiträge wie bei Instagram (Wunsch Nutzer 2026-11-10): der angetippte Beitrag oben, beim Herunterscrollen
// die nächsten. Je Beitrag: Kopf mit Name, darunter Fischart · Länge, rechts „⋯“ (Bearbeiten, Anheften, Teilen,
// Löschen, Datum/Sichtbarkeit, verknüpfter Fang); darunter nur Fotos (Doppeltipp = „Gefällt mir“), Daumen,
// Kommentare und Text. Ist der Beitrag geteilt und das Konto angemeldet, kommen „Gefällt mir“ und Kommentare vom
// Server (Wunsch Nutzer 2026-11-04), sonst bleiben sie auf dem Gerät.
import { canShare, shareContent } from '../../lib/share';
import { postShareText, sharePhotoName } from '../../domain/share';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { TextArea } from '../../design/components/Field';
import { ImagesIcon, MoreIcon } from '../../design/icons';
import { IconButton } from '../../design/components/Button';
import { Sheet } from '../../design/components/Sheet';
import { getDb } from '../../data/db';
import {
  postReactions,
  removePost,
  toggleLike,
  toggleProfileHighlight,
  updatePost,
} from '../../data/profileService';
import {
  lengthText,
  likeIdOf,
  MAX_HIGHLIGHTS,
  parsePostLength,
  POST_CAPTION_MAX,
} from '../../domain/profile';
import { Toast } from '../../design/components/Toast';
import { LOCAL_AUTHOR, type Photo, type Post } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { FounderBadge } from '../badges/FounderBadge';
import { useMyBadges } from '../badges/badgeStore';
import { setShare } from '../../data/postSyncService';
import { retryPostSync, useFailedPosts, useLimitedPosts } from '../sharing/postLimitStore';
import { shareStatus } from '../../domain/postSync';
import { storedUserId } from '../badges/badgeStore';
import { Avatar } from './Avatar';
import { catchSummary } from './catchSummary';
import { CommentsSheet } from './CommentsSheet';
import { ReactionBar } from '../reactions/ReactionBar';
import { ServerCommentsSheet } from '../reactions/ServerCommentsSheet';
import { useServerReactions } from '../reactions/useServerReactions';
import { VisibilityField } from './NewPostPage';
import type { ProfileState } from './ProfilePage';
import { usePhotos, usePosts, useProfile } from './usePhoto';
import { useHaptics } from '../haptics/useHaptics';
import { usePikeLike } from '../reactions/usePikeLike';
import { CatchInfoFields, CatchTag } from './CatchInfoFields';
import styles from './Profile.module.css';

const t = de.profile;

const dateOf = (iso: string, style: 'long' | 'medium' = 'long') =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: style, timeZone: 'Europe/Berlin' });

function Slide({ photo, n, total }: { photo: Photo; n: number; total: number }) {
  const url = useObjectUrl(photo.blob);
  return (
    <li className={styles.slide} aria-roledescription="slide" aria-label={t.photoOf(n, total)}>
      {url && <img src={url} alt={t.photoAlt(n)} draggable={false} />}
    </li>
  );
}

function EditForm({ post, onDone }: { post: Post; onDone: () => void }) {
  const [caption, setCaption] = useState(post.caption ?? '');
  const [visibility, setVisibility] = useState(post.visibility ?? 'friends');
  const [species, setSpecies] = useState(post.speciesId ?? '');
  const [length, setLength] = useState(lengthText(post.lengthCm));
  const [lengthError, setLengthError] = useState<string>();
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        const lengthCm = parsePostLength(length);
        if (lengthCm === 'invalid') return setLengthError(t.catchInfo.lengthInvalid);
        void updatePost(post.id, {
          caption: caption.trim(),
          visibility,
          speciesId: species || undefined,
          lengthCm,
        }).then(onDone);
      }}
    >
      <TextArea
        label={t.caption}
        value={caption}
        rows={4}
        maxLength={POST_CAPTION_MAX}
        onChange={(e) => setCaption(e.target.value)}
      />
      <CatchInfoFields
        speciesId={species}
        length={length}
        lengthError={lengthError}
        onSpecies={setSpecies}
        onLength={setLength}
      />
      {post.groupId ? (
        <p className="muted">{t.visibleForGroup}</p>
      ) : (
        <VisibilityField value={visibility} onChange={setVisibility} />
      )}
      <div className={styles.formActions}>
        <Button type="submit">{t.save}</Button>
        <Button variant="secondary" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Teilen-Stand (Etappe 2): nur auf dem Gerät, wird geteilt, geteilt – mit Knopf zum Teilen/Zurücknehmen */
function ShareRow({ postId, status }: { postId: string; status: 'local' | 'pending' | 'shared' }) {
  const signedIn = !!storedUserId();
  const limited = useLimitedPosts().has(postId) && status === 'pending';
  const failed = useFailedPosts().has(postId) && status === 'pending';
  return (
    <p className={`muted ${styles.shareRow}`}>
      <span role="status">{limited ? t.shareLimited : failed ? t.shareFailed : t.shareStatus[status]}</span>
      {signedIn && failed && (
        <Button variant="secondary" onClick={retryPostSync}>
          {t.shareRetry}
        </Button>
      )}
      {signedIn && status === 'local' && (
        <Button variant="secondary" onClick={() => void setShare(postId, 'pending')}>
          {t.shareNow}
        </Button>
      )}
      {signedIn && status === 'shared' && (
        <Button variant="ghost" onClick={() => void setShare(postId, 'unshare')}>
          {t.unshare}
        </Button>
      )}
    </p>
  );
}

/** Wie viele Beiträge auf einmal dazukommen (beim Herunterscrollen) */
const PAGE = 3;

export function PostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const posts = usePosts();
  // undefined = lädt, null = nicht (mehr) vorhanden
  const exists = useLiveQuery(async () => {
    const p = await getDb().posts.get(id);
    return p && !p.deletedAt ? true : null;
  }, [id]);
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const start = posts ? posts.findIndex((p) => p.id === id) : -1;
  const list = posts && start >= 0 ? posts.slice(start, start + count) : [];
  const more = !!posts && start >= 0 && start + count < posts.length;

  // Weitere Beiträge, sobald das Ende der Liste in Sicht kommt
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((n) => n + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [more, list.length]);

  if (posts === undefined || exists === undefined)
    return (
      <Page title={t.postTitle} back="/profil">
        <Notice>{t.loading}</Notice>
      </Page>
    );
  if (exists === null || start < 0)
    return (
      <Page title={t.postTitle} back="/profil">
        <EmptyState
          icon={<ImagesIcon size={32} />}
          title={t.notFound}
          action={<Button onClick={() => void navigate('/profil')}>{t.backToProfile}</Button>}
        >
          {t.notFoundText}
        </EmptyState>
      </Page>
    );

  return (
    <Page title={t.postTitle} back="/profil">
      <div className={styles.postList}>
        {list.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {more && (
        <div ref={sentinel}>
          <Button variant="ghost" onClick={() => setCount((n) => n + PAGE)}>
            {t.morePosts}
          </Button>
        </div>
      )}
    </Page>
  );
}

function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [shareError, setShareError] = useState<string>();
  const linked = useLiveQuery(
    async () => (post.catchId ? ((await getDb().catches.get(post.catchId)) ?? null) : null),
    [post.catchId],
  );
  const reactions = useLiveQuery(() => postReactions(post.id), [post.id]);
  const photos = usePhotos(post.photoIds);
  const profile = useProfile();
  const [pinMsg, setPinMsg] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = !!profile?.highlightPostIds?.includes(post.id);
  const founder = useMyBadges().includes('founder');
  const [editing, setEditing] = useState(false);
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const likeIconRef = useRef<HTMLSpanElement>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // geteilt + angemeldet: Reaktionen vom Server
  const server = !post.deletedAt && !!storedUserId() && shareStatus(post) === 'shared';
  const srv = useServerReactions([post.id], server);
  const haptics = useHaptics();
  const likedNow = server
    ? srv.get(post.id).liked
    : (reactions?.likes ?? []).some((l) => l.id === likeIdOf(LOCAL_AUTHOR, post.id));
  // Doppeltipp aufs Foto: Hecht schwimmt zum Daumen; setzt „Gefällt mir“ (nie zurücknehmen)
  const pike = usePikeLike({
    frame: frameRef,
    canvas: canvasRef,
    target: likeIconRef,
    liked: likedNow,
    onLike: () => {
      if (server) srv.toggle(post.id);
      else void toggleLike(post.id);
    },
    onArrive: () => {
      setPulse((n) => n + 1);
      haptics.light();
    },
  });

  const total = photos?.length ?? post.photoIds.length;
  const name = profile?.name || t.placeholderName;
  // Teilen (Paket 10): nur eigene Beiträge, Fotos und Text – nie Fangort oder Koordinaten
  const share = canShare()
    ? () =>
        void shareContent({
          title: t.postTitle,
          text: postShareText(post, t.shareFooter),
          files: (photos ?? []).map(
            (p, i) => new File([p.blob], sharePhotoName(post.createdAt, i, p.mime), { type: p.mime }),
          ),
        }).catch(() => setShareError(t.shareError))
    : undefined;
  const likes = reactions?.likes ?? [];
  const comments = reactions?.comments ?? [];
  const liked = likes.some((l) => l.id === likeIdOf(LOCAL_AUTHOR, post.id));
  const serverReactions = srv.get(post.id);
  const commentTotal = server ? serverReactions.commentCount : comments.length;

  return (
    <article className={styles.postCard} aria-label={t.postLabel(dateOf(post.createdAt))}>
      <header className={styles.postCardHead}>
        <Avatar photoId={profile?.avatarPhotoId} size={36} />
        <div className={styles.postCardWho}>
          <span>
            {name}
            {founder && <FounderBadge />}
          </span>
          <CatchTag speciesId={post.speciesId} lengthCm={post.lengthCm} variant="line" />
        </div>
        <IconButton label={t.postOptions} icon={<MoreIcon size={20} />} onClick={() => setMenuOpen(true)} />
      </header>
      <div className={styles.carouselWrap}>
        <div className={styles.carouselBox} ref={frameRef}>
          <ul
            {...pike.handlers}
            className={styles.carousel}
            aria-label={t.postPhotos}
            // mit der Tastatur wischbar (Pfeiltasten)
            tabIndex={0}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
          >
            {(photos ?? []).map((p, i) => (
              <Slide key={p.id} photo={p} n={i + 1} total={total} />
            ))}
          </ul>
          <canvas ref={canvasRef} className={styles.pikeLayer} aria-hidden="true" />
        </div>
        {total > 1 && (
          <p className={styles.dots} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i === index ? styles.dotOn : styles.dot} />
            ))}
          </p>
        )}
      </div>
      <ReactionBar
        likeCount={server ? serverReactions.likeCount : likes.length}
        commentCount={server ? serverReactions.commentCount : comments.length}
        liked={server ? serverReactions.liked : liked}
        onLike={() => (server ? srv.toggle(post.id) : void toggleLike(post.id))}
        onComments={() => setCommentsOpen(true)}
        likeIconRef={likeIconRef}
        pulse={pulse}
        onShare={share}
      />
      {shareError && <Notice tone="error">{shareError}</Notice>}
      {srv.error && server && <Notice tone="error">{srv.error}</Notice>}
      {editing ? (
        <EditForm post={post} onDone={() => setEditing(false)} />
      ) : (
        post.caption && (
          <p className={styles.bio}>
            <strong>{name}</strong>
            {founder && <FounderBadge />} {post.caption}
          </p>
        )
      )}
      {commentTotal > 0 && (
        <button type="button" className={`${styles.linkish} muted`} onClick={() => setCommentsOpen(true)}>
          {t.viewComments(commentTotal)}
        </button>
      )}
      <p className={`muted ${styles.postDate}`}>{dateOf(post.createdAt)}</p>
      {server ? (
        <ServerCommentsSheet
          open={commentsOpen}
          postId={post.id}
          myAvatarPhotoId={profile?.avatarPhotoId}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(d) => srv.addComments(post.id, d)}
        />
      ) : (
        <CommentsSheet
          open={commentsOpen}
          postId={post.id}
          name={name}
          founder={founder}
          avatarPhotoId={profile?.avatarPhotoId}
          onClose={() => setCommentsOpen(false)}
        />
      )}
      <Sheet open={menuOpen} title={t.postOptions} onClose={() => setMenuOpen(false)}>
        <div className={styles.postMenu}>
          <p className="muted">
            {t.postedOn(dateOf(post.createdAt))} ·{' '}
            {post.groupId ? t.visibleForGroup : t.visibleFor(t.visibility[post.visibility ?? 'friends'])}
          </p>
          <ShareRow postId={post.id} status={shareStatus(post)} />
          <p className={`muted ${styles.note}`}>
            {server
              ? de.reactions.sharedNote
              : storedUserId() && shareStatus(post) === 'local'
                ? t.reactionsNoteSignedIn
                : t.reactionsNote}
          </p>
          {linked && !linked.deletedAt && (
            <Link to={`/fangbuch/${linked.id}`} className={styles.catchLink}>
              {t.linkedCatch}: {catchSummary(linked)}
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setEditing(true);
            }}
          >
            {t.editCaption}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={pinned}
            onClick={() =>
              void toggleProfileHighlight(post.id).then((ok) => {
                setMenuOpen(false);
                setPinMsg(ok ? (pinned ? t.unpinned : t.pinned) : t.pinFull(MAX_HIGHLIGHTS));
              })
            }
          >
            {pinned ? t.unpin : t.pin}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              void removePost(post.id).then(() =>
                navigate('/profil', { state: { deletedPostId: post.id } satisfies ProfileState }),
              )
            }
          >
            {t.delete}
          </Button>
        </div>
      </Sheet>
      {pinMsg && <Toast onDismiss={() => setPinMsg(undefined)}>{pinMsg}</Toast>}
    </article>
  );
}
