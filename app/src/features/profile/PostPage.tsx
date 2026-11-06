// Ein Beitrag: Fotos zum Wischen (Doppeltipp = „Gefällt mir“), Daumen und Kommentare, Text, Datum, verknüpfter Fang,
// Sichtbarkeit; bearbeiten, löschen (Rückgängig im Profil). Ist der Beitrag geteilt und das Konto angemeldet, kommen
// „Gefällt mir“ und Kommentare vom Server (Wunsch Nutzer 2026-11-04), sonst bleiben sie auf dem Gerät.
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { TextArea } from '../../design/components/Field';
import { ImagesIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { postReactions, removePost, toggleLike, updatePost } from '../../data/profileService';
import { likeIdOf, POST_CAPTION_MAX } from '../../domain/profile';
import { LOCAL_AUTHOR, type Photo, type Post } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { FounderBadge } from '../badges/FounderBadge';
import { useMyBadges } from '../badges/badgeStore';
import { setShare } from '../../data/postSyncService';
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
import { usePhotos, useProfile } from './usePhoto';
import { useHaptics } from '../haptics/useHaptics';
import { usePikeLike } from '../reactions/usePikeLike';
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
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void updatePost(post.id, { caption: caption.trim(), visibility }).then(onDone);
      }}
    >
      <TextArea
        label={t.caption}
        value={caption}
        rows={4}
        maxLength={POST_CAPTION_MAX}
        onChange={(e) => setCaption(e.target.value)}
      />
      <VisibilityField value={visibility} onChange={setVisibility} />
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
  return (
    <p className={`muted ${styles.shareRow}`}>
      <span role="status">{t.shareStatus[status]}</span>
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

export function PostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  // undefined = lädt, null = nicht vorhanden
  const post = useLiveQuery(async () => (await getDb().posts.get(id)) ?? null, [id]);
  const linked = useLiveQuery(
    async () => (post?.catchId ? ((await getDb().catches.get(post.catchId)) ?? null) : null),
    [post?.catchId],
  );
  const reactions = useLiveQuery(() => postReactions(id), [id]);
  const photos = usePhotos(post?.photoIds);
  const profile = useProfile();
  const founder = useMyBadges().includes('founder');
  const [editing, setEditing] = useState(false);
  const [index, setIndex] = useState(0);
  const [pulse, setPulse] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const likeIconRef = useRef<HTMLSpanElement>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // geteilt + angemeldet: Reaktionen vom Server
  const server = !!post && !post.deletedAt && !!storedUserId() && shareStatus(post) === 'shared';
  const srv = useServerReactions(post ? [post.id] : [], server);
  const haptics = useHaptics();
  const likedNow =
    !!post &&
    (server
      ? srv.get(post.id).liked
      : (reactions?.likes ?? []).some((l) => l.id === likeIdOf(LOCAL_AUTHOR, post.id)));
  // Doppeltipp aufs Foto: Hecht schwimmt zum Daumen; setzt „Gefällt mir“ (nie zurücknehmen)
  const pike = usePikeLike({
    frame: frameRef,
    canvas: canvasRef,
    target: likeIconRef,
    liked: likedNow,
    onLike: () => {
      if (!post) return;
      if (server) srv.toggle(post.id);
      else void toggleLike(post.id);
    },
    onArrive: () => {
      setPulse((n) => n + 1);
      haptics.light();
    },
  });

  if (post === undefined)
    return (
      <Page title={t.postTitle} back="/profil">
        <Notice>{t.loading}</Notice>
      </Page>
    );
  if (post === null || post.deletedAt)
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

  const total = photos?.length ?? post.photoIds.length;
  const name = profile?.name || t.placeholderName;
  const likes = reactions?.likes ?? [];
  const comments = reactions?.comments ?? [];
  const liked = likes.some((l) => l.id === likeIdOf(LOCAL_AUTHOR, post.id));
  const serverReactions = srv.get(post.id);
  const commentTotal = server ? serverReactions.commentCount : comments.length;

  return (
    <Page title={t.postTitle} back="/profil">
      <div className={styles.postHead}>
        <Avatar photoId={profile?.avatarPhotoId} size={36} />
        <strong>{name}</strong>
        {founder && <FounderBadge />}
      </div>
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
      />
      {srv.error && server && <Notice tone="error">{srv.error}</Notice>}
      {editing ? (
        <EditForm post={post} onDone={() => setEditing(false)} />
      ) : (
        <div className={styles.top}>
          {post.caption && (
            <p className={styles.bio}>
              <strong>{name}</strong>
              {founder && <FounderBadge />} {post.caption}
            </p>
          )}
          <p className={`muted ${styles.note}`}>
            {t.postedOn(dateOf(post.createdAt))} · {t.visibleFor(t.visibility[post.visibility ?? 'friends'])}
          </p>
          <ShareRow postId={post.id} status={shareStatus(post)} />
          {linked && !linked.deletedAt && (
            <Link to={`/fangbuch/${linked.id}`} className={styles.catchLink}>
              {t.linkedCatch}: {catchSummary(linked)}
            </Link>
          )}
        </div>
      )}
      {commentTotal > 0 && (
        <button type="button" className={`${styles.linkish} muted`} onClick={() => setCommentsOpen(true)}>
          {t.viewComments(commentTotal)}
        </button>
      )}
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
      <p className={`muted ${styles.note}`}>{server ? de.reactions.sharedNote : t.reactionsNote}</p>
      {!editing && (
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t.editCaption}
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
      )}
    </Page>
  );
}
