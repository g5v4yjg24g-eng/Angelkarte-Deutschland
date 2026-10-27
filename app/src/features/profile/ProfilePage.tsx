// Profilseite (Wunsch Nutzer 2026-10-27, Vorbild Instagram ohne Story-Highlights und Reiterzeile): Profilbild, Name,
// Zahlen, Text, Knöpfe und Raster der Beiträge. Follower/Gefolgt, Teilen und Freunde hinzufügen kommen mit dem Konto.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button, IconButton } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { ImagesIcon, PlusIcon, UserPlusIcon } from '../../design/icons';
import { restorePost } from '../../data/profileService';
import type { Post } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { Avatar } from './Avatar';
import { usePhotos, usePosts, useProfile } from './usePhoto';
import styles from './Profile.module.css';

const t = de.profile;

export interface ProfileState {
  deletedPostId?: string;
}

function Tile({ post, n }: { post: Post; n: number }) {
  const photos = usePhotos(post.photoIds.slice(0, 1));
  const url = useObjectUrl(photos?.[0]?.thumb ?? photos?.[0]?.blob);
  return (
    <li>
      <Link
        to={`/profil/beitrag/${post.id}`}
        className={styles.tile}
        aria-label={t.openPost(n, post.caption)}
      >
        {url && <img src={url} alt="" />}
        {post.photoIds.length > 1 && (
          <span className={styles.multi} title={t.multiPhoto}>
            <ImagesIcon size={18} />
          </span>
        )}
      </Link>
    </li>
  );
}

function Count({ value, label }: { value: string; label: string }) {
  return (
    <span className={styles.count}>
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

export function ProfilePage() {
  const profile = useProfile();
  const posts = usePosts();
  const navigate = useNavigate();
  const location = useLocation();
  const [soon, setSoon] = useState(false);
  const [undoId, setUndoId] = useState(() => (location.state as ProfileState | null)?.deletedPostId);
  const [restored, setRestored] = useState(false);

  const newPost = (
    <IconButton label={t.newPost} icon={<PlusIcon />} onClick={() => void navigate('/profil/neu')} />
  );

  if (profile === undefined || posts === undefined)
    return (
      <Page title={t.title}>
        <Notice>{t.loading}</Notice>
      </Page>
    );

  return (
    <Page title={t.title} action={newPost}>
      <div className={styles.top}>
        <section className={styles.header} aria-label={t.title}>
          <Avatar photoId={profile?.avatarPhotoId} />
          <div className={styles.headMain}>
            <p className={profile ? styles.name : `${styles.name} muted`}>
              {profile?.name || t.placeholderName}
            </p>
            <div className={styles.counts}>
              <Count value={posts.length.toLocaleString('de-DE')} label={t.posts} />
              <Count value={t.noCount} label={t.followers} />
              <Count value={t.noCount} label={t.following} />
            </div>
          </div>
        </section>
        {profile?.bio && <p className={styles.bio}>{profile.bio}</p>}
        <div className={styles.buttons}>
          <Button variant="secondary" onClick={() => void navigate('/profil/bearbeiten')}>
            {t.edit}
          </Button>
          <Button variant="secondary" className={styles.soon} onClick={() => setSoon(true)}>
            {t.share}
          </Button>
          <IconButton
            label={t.addFriends}
            icon={<UserPlusIcon size={20} />}
            className={`${styles.squareButton} ${styles.soon}`}
            onClick={() => setSoon(true)}
          />
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<ImagesIcon size={32} />}
          title={t.emptyTitle}
          action={<Button onClick={() => void navigate('/profil/neu')}>{t.firstPost}</Button>}
        >
          {t.emptyText}
        </EmptyState>
      ) : (
        <ul className={styles.grid} aria-label={t.gridLabel}>
          {posts.map((p, i) => (
            <Tile key={p.id} post={p} n={i + 1} />
          ))}
        </ul>
      )}
      <p className={`muted ${styles.note}`}>{t.localNote}</p>

      {soon && <Toast onDismiss={() => setSoon(false)}>{t.comingSoon}</Toast>}
      {(undoId || restored) && (
        <Toast
          onDismiss={() => {
            setUndoId(undefined);
            setRestored(false);
            void navigate('.', { replace: true, state: null });
          }}
          actions={
            undoId && (
              <Button
                variant="ghost"
                onClick={() =>
                  void restorePost(undoId).then(() => {
                    setUndoId(undefined);
                    setRestored(true);
                  })
                }
              >
                {t.undo}
              </Button>
            )
          }
        >
          {restored ? t.restored : t.deleted}
        </Toast>
      )}
    </Page>
  );
}
