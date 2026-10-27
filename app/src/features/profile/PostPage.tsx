// Ein Beitrag: Fotos zum Wischen (Doppeltipp = „Gefällt mir“), Herz und Kommentare, Text, Datum, verknüpfter Fang,
// Sichtbarkeit; bearbeiten, löschen (Rückgängig im Profil). Likes und Kommentare sind vorerst nur die eigenen.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button, IconButton } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { TextArea } from '../../design/components/Field';
import { Toast } from '../../design/components/Toast';
import { CloseIcon, CommentIcon, HeartIcon, ImagesIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import {
  addComment,
  postReactions,
  removeComment,
  removePost,
  restoreComment,
  toggleLike,
  updatePost,
} from '../../data/profileService';
import { COMMENT_MAX, commentValid, likeIdOf, POST_CAPTION_MAX } from '../../domain/profile';
import { LOCAL_AUTHOR, type Photo, type Post } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { Avatar } from './Avatar';
import { catchSummary } from './catchSummary';
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

function Comments({
  postId,
  name,
  avatarPhotoId,
}: {
  postId: string;
  name: string;
  avatarPhotoId?: string | undefined;
}) {
  const reactions = useLiveQuery(() => postReactions(postId), [postId]);
  const [text, setText] = useState('');
  const [undo, setUndo] = useState<{ id: string; restored: boolean }>();
  const comments = reactions?.comments ?? [];

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!commentValid(text)) return;
    void addComment(postId, text).then(() => setText(''));
  };

  return (
    <Section title={t.commentsTitle}>
      {comments.length === 0 ? (
        <p className="muted">{t.noComments}</p>
      ) : (
        <ul className={styles.comments}>
          {comments.map((c) => (
            <li key={c.id} className={styles.comment}>
              <Avatar photoId={c.authorId === LOCAL_AUTHOR ? avatarPhotoId : undefined} size={32} />
              <div className={styles.commentBody}>
                <p>
                  <strong>{name}</strong> {c.text}
                </p>
                <small className="muted">{dateOf(c.createdAt, 'medium')}</small>
              </div>
              {c.authorId === LOCAL_AUTHOR && (
                <IconButton
                  label={t.deleteComment}
                  icon={<CloseIcon size={18} />}
                  onClick={() => void removeComment(c.id).then(() => setUndo({ id: c.id, restored: false }))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <form className={styles.commentForm} onSubmit={send}>
        <div className={styles.commentField} data-comment-field>
          <TextArea
            label={t.commentLabel}
            value={text}
            rows={2}
            maxLength={COMMENT_MAX}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!commentValid(text)}>
          {t.commentSend}
        </Button>
      </form>
      {undo && (
        <Toast
          onDismiss={() => setUndo(undefined)}
          actions={
            !undo.restored && (
              <Button
                variant="ghost"
                onClick={() => void restoreComment(undo.id).then(() => setUndo({ ...undo, restored: true }))}
              >
                {t.undo}
              </Button>
            )
          }
        >
          {undo.restored ? t.commentRestored : t.commentDeleted}
        </Toast>
      )}
    </Section>
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
              <HeartIcon filled size={96} />
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
      <div className={styles.reactions}>
        <div className={styles.reactionButtons}>
          <IconButton
            label={t.like}
            aria-pressed={liked}
            className={liked ? styles.liked : ''}
            icon={<HeartIcon filled={liked} size={28} />}
            onClick={() => void toggleLike(post.id)}
          />
          <IconButton
            label={t.commentAction}
            icon={<CommentIcon size={26} />}
            onClick={() => document.querySelector<HTMLElement>('[data-comment-field] textarea')?.focus()}
          />
        </div>
        {likes.length > 0 && <strong>{t.likeCount(likes.length)}</strong>}
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
      <Comments postId={post.id} name={name} avatarPhotoId={profile?.avatarPhotoId} />
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
