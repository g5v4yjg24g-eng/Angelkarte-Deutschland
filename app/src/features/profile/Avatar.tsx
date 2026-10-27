// Profilbild als Kreis; ohne Bild ein neutrales Personen-Symbol.
import { de } from '../../i18n/de';
import { UserIcon } from '../../design/icons';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { usePhotos } from './usePhoto';
import styles from './Profile.module.css';

export function Avatar({
  photoId,
  blob,
  size = 86,
}: {
  photoId?: string | undefined;
  blob?: Blob;
  size?: number;
}) {
  const photos = usePhotos(photoId ? [photoId] : undefined);
  const url = useObjectUrl(blob ?? photos?.[0]?.thumb ?? photos?.[0]?.blob);
  return (
    <span className={styles.avatar} style={{ width: size, height: size }}>
      {url ? <img src={url} alt={de.profile.avatarAlt} /> : <UserIcon size={Math.round(size * 0.45)} />}
    </span>
  );
}
