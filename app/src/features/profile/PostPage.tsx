// Ein Beitrag: Fotos zum Wischen (Doppeltipp = „Gefällt mir“), Herz und Kommentare, Text, Datum, verknüpfter Fang,
// Sichtbarkeit; bearbeiten, löschen (Rückgängig im Profil). Likes und Kommentare sind vorerst nur die eigenen.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { TextArea } from '../../design/components/Field';
import { CommentIcon, ImagesIcon, ThumbsUpIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { postReactions, removePost, toggleLike, updatePost } from '../../data/profileService';
import { likeIdOf, POST_CAPTION_MAX } from '../../domain/profile';
import { LOCAL_AUTHOR, type Photo, type Post } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { Avatar } from './Avatar';
import { catchSummary } from './catchSummary';
import { CommentsSheet } from './CommentsSheet';
import { VisibilityField } from './NewPostPage';
import type { ProfileState } from './ProfilePage';
import { usePhotos, useProfile } from './usePhoto';
import styles from './Profile.module.css';

const t = de.profile;

const dateOf = (iso: string, style: 'long' | 'medium' = 'long') =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: style, timeZone: 'Europe/Berlin' });

function Slide({
  photo,
  n,
  total,
  onDoubleTap,
}: {
  photo: Photo;
  n: number;
  total: number;
  onDoubleTap: () => void;
}) {
  const url = useObjectUrl(photo.blob);
  return (
    <li
      className={styles.slide}
      aria-roledescription="slide"
      aria-label={t.photoOf(n, total)}
      onDoubleClick={onDoubleTap}
    >
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
  const [editing, setEditing] = useState(false);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

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
  const likeByDoubleTap = () => {
    setBurst((b) => b + 1);
    if (!liked) void toggleLike(post.id);
  };

  return (
    <Page title={t.postTitle} back="/profil">
      <div className={styles.postHead}>
        <Avatar photoId={profile?.avatarPhotoId} size={36} />
        <strong>{name}</strong>
      </div>
      <div className={styles.carouselWrap}>
        <div className={styles.carouselBox}>
          <ul
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
              <Slide key={p.id} photo={p} n={i + 1} total={total} onDoubleTap={likeByDoubleTap} />
            ))}
          </ul>
          {burst > 0 && (
            <span key={burst} className={styles.burst} aria-hidden="true">
              <ThumbsUpIcon filled size={96} />
            </span>
          )}
        </div>
        {total > 1 && (
          <p className={styles.dots} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i === index ? styles.dotOn : styles.dot} />
            ))}
          </p>
        )}
      </div>
      {(likes.length > 0 || comments.length > 0) && (
        <div className={styles.counts2}>
          <span>
            {likes.length > 0 && (
              <>
                <span className={styles.likeBadge} aria-hidden="true">
                  <ThumbsUpIcon filled size={12} />
                </span>{' '}
                {t.likeCount(likes.length)}
              </>
            )}
          </span>
          {comments.length > 0 && (
            <button type="button" className={styles.linkish} onClick={() => setCommentsOpen(true)}>
              {t.commentCount(comments.length)}
            </button>
          )}
        </div>
      )}
      <div className={styles.actionRow}>
        <button
          type="button"
          className={[styles.action, liked ? styles.liked : ''].join(' ')}
          aria-pressed={liked}
          onClick={() => void toggleLike(post.id)}
        >
          <ThumbsUpIcon filled={liked} size={22} />
          <span>{t.like}</span>
        </button>
        <button type="button" className={styles.action} onClick={() => setCommentsOpen(true)}>
          <CommentIcon size={22} />
          <span>{t.commentAction}</span>
        </button>
      </div>
      {editing ? (
        <EditForm post={post} onDone={() => setEditing(false)} />
      ) : (
        <div className={styles.top}>
          {post.caption && (
            <p className={styles.bio}>
              <strong>{name}</strong> {post.caption}
            </p>
          )}
          <p className={`muted ${styles.note}`}>
            {t.postedOn(dateOf(post.createdAt))} · {t.visibleFor(t.visibility[post.visibility ?? 'friends'])}
          </p>
          {linked && !linked.deletedAt && (
            <Link to={`/fangbuch/${linked.id}`} className={styles.catchLink}>
              {t.linkedCatch}: {catchSummary(linked)}
            </Link>
          )}
        </div>
      )}
      {comments.length > 0 && (
        <button type="button" className={`${styles.linkish} muted`} onClick={() => setCommentsOpen(true)}>
          {t.viewComments(comments.length)}
        </button>
      )}
      <CommentsSheet
        open={commentsOpen}
        postId={post.id}
        name={name}
        avatarPhotoId={profile?.avatarPhotoId}
        onClose={() => setCommentsOpen(false)}
      />
      <p className={`muted ${styles.note}`}>{t.reactionsNote}</p>
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
