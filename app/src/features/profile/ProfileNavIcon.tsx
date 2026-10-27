// Symbol „Profil“ in der unteren Leiste: das eigene Profilbild als Kreis, sonst das Personen-Symbol.
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { PROFILE_ID } from '../../domain/schemas';
import { UserIcon } from '../../design/icons';
import { useObjectUrl } from '../../lib/useObjectUrl';
import styles from './Profile.module.css';

export function ProfileNavIcon() {
  const blob = useLiveQuery(async () => {
    const db = getDb();
    const p = await db.profiles.get(PROFILE_ID);
    if (!p?.avatarPhotoId || p.deletedAt) return undefined;
    const photo = await db.photos.get(p.avatarPhotoId);
    return photo?.thumb ?? photo?.blob;
  }, []);
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt="" className={styles.navAvatar} /> : <UserIcon />;
}
