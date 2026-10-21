// Fotos eines Eintrags: Vorschaubilder, Antippen zeigt das Foto groß.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Lightbox } from '../../design/components/Lightbox';
import { getDb } from '../../data/db';
import type { Photo } from '../../domain/schemas';
import { useObjectUrl } from '../../lib/useObjectUrl';
import styles from './CatchPhotos.module.css';

const t = de.catchForm;

export function PhotoThumb({ blob, alt }: { blob: Blob | undefined; alt: string }) {
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt={alt} className={styles.thumbImg} /> : <span className={styles.thumbImg} />;
}

function Full({ photo, n, onClose }: { photo: Photo; n: number; onClose: () => void }) {
  const url = useObjectUrl(photo.blob);
  return url ? <Lightbox src={url} alt={t.photoAlt(n)} closeLabel={t.closePhoto} onClose={onClose} /> : null;
}

export function CatchPhotos({ ids }: { ids: readonly string[] | undefined }) {
  const photos = useLiveQuery(
    async () => (ids?.length ? (await getDb().photos.bulkGet([...ids])).filter((p): p is Photo => !!p) : []),
    [ids?.join(',')],
  );
  const [open, setOpen] = useState<number>();
  if (!photos?.length) return null;
  const shown = open === undefined ? undefined : photos[open];
  return (
    <>
      <ul className={styles.strip} aria-label={t.photos}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className={styles.thumb}
              aria-label={t.openPhoto(i + 1)}
              onClick={() => setOpen(i)}
            >
              <PhotoThumb blob={p.thumb ?? p.blob} alt="" />
            </button>
          </li>
        ))}
      </ul>
      {shown && open !== undefined && <Full photo={shown} n={open + 1} onClose={() => setOpen(undefined)} />}
    </>
  );
}
