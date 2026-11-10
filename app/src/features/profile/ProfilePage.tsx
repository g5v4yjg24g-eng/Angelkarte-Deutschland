// Profilseite (Wunsch Nutzer 2026-10-27, Vorbild Instagram ohne Story-Highlights und Reiterzeile): Profilbild, Name,
// Zahlen, Text, Knöpfe und Raster der Beiträge. Freunde (Etappe 1) über /profil/freunde; „Profil teilen“ folgt.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button, IconButton } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { ImagesIcon, MapIcon, PlusIcon, UserPlusIcon, BookmarkIcon } from '../../design/icons';
import { restorePost } from '../../data/profileService';
import { shareAllLocal } from '../../data/postSyncService';
import type { Post, Profile } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { FounderBadge } from '../badges/FounderBadge';
import { useMyBadges } from '../badges/badgeStore';
import { useFriends } from '../friends/useFriends';
import { Avatar } from './Avatar';
import { usePhotos, usePosts, useProfile } from './usePhoto';
import { ProfileAchievements } from '../achievements/ProfileAchievements';
import { highlightedPosts } from '../../domain/profile';
import { speciesById } from '../../domain/species';
import { useProviders } from '../../ports/providersContext';
import type { AccountProvider } from '../../ports/account';
import { profileLink } from '../../domain/profileLink';
import { canShare, shareContent } from '../../lib/share';
import { storedUserId } from '../badges/badgeStore';
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

/** Freiwillige Angaben (Paket 11): nur zeigen, was ausgefüllt ist */
export function ProfileFacts({
  profile,
}: {
  profile: Pick<Profile, 'targetSpecies' | 'methods' | 'region'>;
}) {
  const species = (profile.targetSpecies ?? []).map((id) => speciesById(id)?.de ?? id);
  const methods = (profile.methods ?? []).map((m) => de.catchForm.methods[m]);
  if (!species.length && !methods.length && !profile.region) return null;
  return (
    <dl className={styles.facts}>
      {species.length > 0 && (
        <div>
          <dt>{t.factSpecies}</dt>
          <dd>{species.join(' · ')}</dd>
        </div>
      )}
      {methods.length > 0 && (
        <div>
          <dt>{t.factMethods}</dt>
          <dd>{methods.join(' · ')}</dd>
        </div>
      )}
      {profile.region && (
        <div>
          <dt>{t.factRegion}</dt>
          <dd>{de.water.states[profile.region]}</dd>
        </div>
      )}
    </dl>
  );
}

/** Angeheftete Beiträge (Paket 11, höchstens drei) */
function Highlights({ posts, all }: { posts: Post[]; all: Post[] }) {
  if (!posts.length) return null;
  return (
    <section className={styles.highlights} aria-labelledby="profile-highlights">
      <h2 id="profile-highlights">{t.highlightsTitle}</h2>
      <ul className={styles.highlightRow}>
        {posts.map((p) => (
          <Tile key={p.id} post={p} n={all.indexOf(p) + 1} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Profil teilen: Link mit dem Nutzernamen übers Teilen-Menü; ohne Teilen-Funktion (Computer) in die Zwischenablage.
 * Liefert den Hinweistext (oder nichts, wenn das Teilen-Menü offen war).
 */
async function shareMyProfile(
  account: AccountProvider,
  localName: string | undefined,
): Promise<string | undefined> {
  if (!account.enabled || !storedUserId()) return t.shareNeedsAccount;
  let me;
  try {
    me = await account.getProfile();
  } catch {
    return t.shareError;
  }
  if (!me) return t.shareNeedsAccount;
  const url = profileLink(me.username);
  const text = t.shareProfileText(me.displayName || localName || me.username, me.username);
  try {
    if (canShare()) {
      await shareContent({ title: t.shareProfileTitle, text, url });
      return undefined;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return t.linkCopied;
  } catch {
    return t.shareError;
  }
}

export function ProfilePage() {
  const profile = useProfile();
  const posts = usePosts();
  const founder = useMyBadges().includes('founder');
  const { state: friends } = useFriends();
  const friendCount =
    friends.kind === 'ready'
      ? friends.list.filter((f) => f.status === 'accepted').length.toLocaleString('de-DE')
      : t.noCount;
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<string>();
  const { account } = useProviders();
  const localCount = (posts ?? []).filter((p) => !p.deletedAt && !p.share).length;
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
            {founder && (
              <p className={styles.badgeRow}>
                <FounderBadge variant="full" />
              </p>
            )}
            <div className={styles.counts}>
              <Count value={posts.length.toLocaleString('de-DE')} label={t.posts} />
              <Count value={friendCount} label={t.friendsCount} />
            </div>
          </div>
        </section>
        {profile?.bio && <p className={styles.bio}>{profile.bio}</p>}
        {profile && <ProfileFacts profile={profile} />}
        <div className={styles.buttons}>
          <Button variant="secondary" onClick={() => void navigate('/profil/bearbeiten')}>
            {t.edit}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void shareMyProfile(account, profile?.name).then(setNotice)}
          >
            {t.share}
          </Button>
          <IconButton
            label={t.addFriends}
            icon={<UserPlusIcon size={20} />}
            className={styles.squareButton}
            onClick={() => void navigate('/profil/freunde')}
          />
          <IconButton
            label={de.spots.open}
            icon={<MapIcon size={20} />}
            className={styles.squareButton}
            onClick={() => void navigate('/profil/spots')}
          />
          <IconButton
            label={de.feed.savedTitle}
            icon={<BookmarkIcon size={20} />}
            className={styles.squareButton}
            onClick={() => void navigate('/profil/gespeichert')}
          />
        </div>
      </div>

      {localCount > 0 && storedUserId() && (
        <Notice>
          <span className={styles.localPosts}>
            {t.localPosts(localCount)}
            <Button
              variant="secondary"
              onClick={() => void shareAllLocal().then((n) => setNotice(t.sharedAll(n)))}
            >
              {t.shareAll}
            </Button>
          </span>
        </Notice>
      )}
      <ProfileAchievements />
      <Highlights posts={highlightedPosts(profile?.highlightPostIds, posts)} all={posts} />

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

      {notice && <Toast onDismiss={() => setNotice(undefined)}>{notice}</Toast>}
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
