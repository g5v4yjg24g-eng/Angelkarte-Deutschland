// Neuer Beitrag: Fotos wählen (neu kodiert, ohne EXIF), Text, optional mit einem Fang verknüpfen. Ist ein Fang
// gewählt, lassen sich seine Fotos übernehmen (als Kopie). Aufruf aus einem Fang: /profil/neu?fang=<id>.
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { SelectField, TextArea } from '../../design/components/Field';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import type { Post } from '../../domain/schemas';
import { CloseIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { createPost } from '../../data/profileService';
import { newId } from '../../domain/id';
import { canPublish, MAX_PHOTOS_PER_POST, photoRoom, POST_CAPTION_MAX } from '../../domain/profile';
import { processPhoto, type ProcessedPhoto } from '../../lib/processPhoto';
import { PhotoThumb } from '../catches/CatchPhotos';
import { catchSummary } from './catchSummary';
import { usePhotos } from './usePhoto';
import photoStyles from '../catches/CatchPhotos.module.css';
import styles from './Profile.module.css';

const t = de.profile;

export function NewPostPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [catchId, setCatchId] = useState(params.get('fang') ?? '');
  const [pending, setPending] = useState<{ key: string; photo: ProcessedPhoto }[]>([]);
  /** abgewählte Fangfotos (Standard: alle übernehmen) */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<NonNullable<Post['visibility']>>('friends');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const catches = useLiveQuery(
    async () => (await getDb().catches.orderBy('at').reverse().toArray()).filter((c) => !c.deletedAt),
    [],
  );
  const chosen = catches?.find((c) => c.id === catchId);
  const catchPhotos = usePhotos(chosen?.photoIds);
  const takenFromCatch = (catchPhotos ?? []).filter((p) => !skipped.includes(p.id));
  const count = takenFromCatch.length + pending.length;
  const options = useMemo(
    () => [
      { value: '', label: t.noCatch },
      ...(catches ?? []).map((c) => ({ value: c.id, label: catchSummary(c) })),
    ],
    [catches],
  );

  const pick = async (files: File[]) => {
    setError(undefined);
    setBusy(true);
    const room = photoRoom(count);
    const added: typeof pending = [];
    for (const f of files.slice(0, room))
      try {
        added.push({ key: newId(), photo: await processPhoto(f) });
      } catch {
        setError(t.photoError);
      }
    if (files.length > room) setError(t.photoLimit(MAX_PHOTOS_PER_POST));
    setPending((p) => [...p, ...added]);
    setBusy(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canPublish(count)) return setError(count ? t.photoLimit(MAX_PHOTOS_PER_POST) : t.needPhoto);
    setBusy(true);
    try {
      await createPost({
        caption: caption.trim(),
        catchId: chosen?.id,
        visibility,
        photos: pending.map((p) => p.photo),
        catchPhotoIds: takenFromCatch.map((p) => p.id),
      });
      void navigate('/profil');
    } catch {
      setError(t.saveError);
      setBusy(false);
    }
  };

  const fileInput = (capture: boolean) => (
    <label
      className={photoStyles.fileLabel}
      aria-disabled={busy || count >= MAX_PHOTOS_PER_POST || undefined}
    >
      {capture ? t.takePhoto : t.choosePhotos}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' as const } : { multiple: true })}
        disabled={busy || count >= MAX_PHOTOS_PER_POST}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void pick(files);
        }}
      />
    </label>
  );

  return (
    <Page title={t.newPost} back="/profil">
      <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <SelectField
          label={t.linkCatch}
          value={catchId}
          options={options}
          onChange={(e) => {
            setCatchId(e.target.value);
            setSkipped([]);
          }}
        />
        {!!catchPhotos?.length && (
          <fieldset className={photoStyles.picker}>
            <legend>{t.catchPhotos}</legend>
            <ul className={photoStyles.strip}>
              {catchPhotos.map((p, i) => {
                const on = !skipped.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={[photoStyles.thumb, styles.pickable].join(' ')}
                      aria-pressed={on}
                      aria-label={t.catchPhotoToggle(i + 1)}
                      onClick={() => setSkipped((s) => (on ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                    >
                      <PhotoThumb blob={p.thumb ?? p.blob} alt="" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        <fieldset className={photoStyles.picker}>
          <legend>{t.postPhotos}</legend>
          {pending.length > 0 && (
            <ul className={photoStyles.strip}>
              {pending.map((p, i) => (
                <li key={p.key} className={photoStyles.thumb}>
                  <PhotoThumb blob={p.photo.thumb} alt={t.photoAlt(i + 1)} />
                  <button
                    type="button"
                    className={photoStyles.remove}
                    aria-label={t.removePhoto(i + 1)}
                    onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}
                  >
                    <CloseIcon size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={photoStyles.buttons}>
            {fileInput(true)}
            {fileInput(false)}
          </div>
          {busy && <p className="muted">{t.processing}</p>}
        </fieldset>
        <TextArea
          label={t.caption}
          hint={t.captionHint}
          value={caption}
          rows={4}
          maxLength={POST_CAPTION_MAX}
          onChange={(e) => setCaption(e.target.value)}
        />
        <VisibilityField value={visibility} onChange={setVisibility} />
        {error && <Notice tone="error">{error}</Notice>}
        <div className={styles.formActions}>
          <Button type="submit" disabled={busy}>
            {t.publish}
          </Button>
          <Button variant="secondary" onClick={() => void navigate('/profil')}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Page>
  );
}

export function VisibilityField({
  value,
  onChange,
}: {
  value: NonNullable<Post['visibility']>;
  onChange: (v: NonNullable<Post['visibility']>) => void;
}) {
  return (
    <div className={styles.visibility}>
      <span className={styles.fieldLabel} aria-hidden="true">
        {t.visibilityLabel}
      </span>
      <SegmentedControl
        label={t.visibilityLabel}
        value={value}
        onChange={onChange}
        options={[
          { value: 'friends', label: t.visibility.friends },
          { value: 'public', label: t.visibility.public },
        ]}
      />
      <small className="muted">{t.visibilityHint}</small>
    </div>
  );
}
