// Fotos im Fangformular: aufnehmen oder aus der Galerie wählen, Vorschau, entfernen (M5.2).
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { CloseIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import type { Photo } from '../../domain/schemas';
import { MAX_PHOTOS_PER_CATCH } from '../../domain/photo';
import type { ProcessedPhoto } from '../../lib/processPhoto';
import { PhotoThumb } from './CatchPhotos';
import styles from './CatchPhotos.module.css';

const t = de.catchForm;

export interface PendingPhoto {
  key: string;
  photo: ProcessedPhoto;
}

export function PhotoPicker({
  existingIds,
  pending,
  processing,
  error,
  onPick,
  onRemoveExisting,
  onRemovePending,
}: {
  existingIds: readonly string[];
  pending: readonly PendingPhoto[];
  processing: boolean;
  error?: string | undefined;
  onPick: (files: File[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (key: string) => void;
}) {
  const existing = useLiveQuery(
    async () =>
      existingIds.length
        ? (await getDb().photos.bulkGet([...existingIds])).filter((p): p is Photo => !!p)
        : [],
    [existingIds.join(',')],
  );
  const count = existingIds.length + pending.length;
  const full = count >= MAX_PHOTOS_PER_CATCH;
  const items = [
    ...(existing ?? []).map((p) => ({
      key: p.id,
      blob: p.thumb ?? p.blob,
      remove: () => onRemoveExisting(p.id),
    })),
    ...pending.map((p) => ({ key: p.key, blob: p.photo.thumb, remove: () => onRemovePending(p.key) })),
  ];

  const input = (capture: boolean) => (
    <label className={styles.fileLabel} aria-disabled={full || processing || undefined}>
      {capture ? t.takePhoto : t.choosePhotos}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' as const } : { multiple: true })}
        disabled={full || processing}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ''; // dieselbe Datei erneut wählbar
          if (files.length) onPick(files);
        }}
      />
    </label>
  );

  return (
    <fieldset className={styles.picker}>
      <legend>{t.photos}</legend>
      {items.length > 0 && (
        <ul className={styles.strip}>
          {items.map((it, i) => (
            <li key={it.key} className={styles.thumb}>
              <PhotoThumb blob={it.blob} alt={t.photoAlt(i + 1)} />
              <button
                type="button"
                className={styles.remove}
                aria-label={t.removePhoto(i + 1)}
                onClick={it.remove}
              >
                <CloseIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.buttons}>
        {input(true)}
        {input(false)}
      </div>
      {processing && <p className="muted">{t.photoProcessing}</p>}
      {full && <p className="muted">{t.photoLimit(MAX_PHOTOS_PER_CATCH)}</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <p className="muted">{t.photoHint}</p>
    </fieldset>
  );
}
