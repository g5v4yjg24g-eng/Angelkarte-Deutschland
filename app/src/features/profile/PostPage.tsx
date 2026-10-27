// Ein Beitrag: Fotos zum Wischen, Text, Datum, verknüpfter Fang; Text bearbeiten, löschen (Rückgängig im Profil).
import { useState } from 'react';
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
import { removePost, updatePostCaption } from '../../data/profileService';
import { POST_CAPTION_MAX } from '../../domain/profile';
import type { Photo } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { Avatar } from './Avatar';
import { catchSummary } from './catchSummary';
import type { ProfileState } from './ProfilePage';
import { usePhotos, useProfile } from './usePhoto';
import styles from './Profile.module.css';

const t = de.profile;

function Slide({ photo, n, total }: { photo: Photo; n: number; total: number }) {
  const url = useObjectUrl(photo.blob);
  return (
    <li className={styles.slide} aria-roledescription="slide" aria-label={t.photoOf(n, total)}>
      {url && <img src={url} alt={t.photoAlt(n)} />}
    </li>
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
  const photos = usePhotos(post?.photoIds);
  const profile = useProfile();
  const [editing, setEditing] = useState<string>();
  const [index, setIndex] = useState(0);

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

  const date = new Date(post.createdAt).toLocaleDateString('de-DE', {
    dateStyle: 'long',
    timeZone: 'Europe/Berlin',
  });
  const total = photos?.length ?? post.photoIds.length;

  return (
    <Page title={t.postTitle} back="/profil">
      <div className={styles.postHead}>
        <Avatar photoId={profile?.avatarPhotoId} size={36} />
        <strong>{profile?.name || t.placeholderName}</strong>
      </div>
      <div className={styles.carouselWrap}>
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
            <Slide key={p.id} photo={p} n={i + 1} total={total} />
          ))}
        </ul>
        {total > 1 && (
          <p className={styles.dots} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i === index ? styles.dotOn : styles.dot} />
            ))}
          </p>
        )}
      </div>
      {editing !== undefined ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void updatePostCaption(post.id, editing.trim()).then(() => setEditing(undefined));
          }}
        >
          <TextArea
            label={t.caption}
            value={editing}
            rows={4}
            maxLength={POST_CAPTION_MAX}
            onChange={(e) => setEditing(e.target.value)}
          />
          <div className={styles.formActions}>
            <Button type="submit">{t.save}</Button>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.top}>
          {post.caption && <p className={styles.bio}>{post.caption}</p>}
          <p className={`muted ${styles.note}`}>{t.postedOn(date)}</p>
          {linked && !linked.deletedAt && (
            <Link to={`/fangbuch/${linked.id}`} className={styles.catchLink}>
              {t.linkedCatch}: {catchSummary(linked)}
            </Link>
          )}
        </div>
      )}
      {editing === undefined && (
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={() => setEditing(post.caption ?? '')}>
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
