// Profil bearbeiten: Profilbild, Name, Text. Das Bild wird wie Fangfotos neu kodiert (ohne EXIF).
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextArea, TextField } from '../../design/components/Field';
import { saveProfile } from '../../data/profileService';
import { profileNameValid, PROFILE_BIO_MAX, PROFILE_NAME_MAX } from '../../domain/profile';
import type { Profile } from '../../domain/schemas';
import { processPhoto, type ProcessedPhoto } from '../../lib/processPhoto';
import { Avatar } from './Avatar';
import { useProfile } from './usePhoto';
import photoStyles from '../catches/CatchPhotos.module.css';
import styles from './Profile.module.css';

const t = de.profile;

function Form({ initial }: { initial: Profile | null }) {
  const navigate = useNavigate();
  const [name, setName] = useState(initial?.name ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  // undefined = unverändert, null = entfernen
  const [avatar, setAvatar] = useState<ProcessedPhoto | null>();
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const hasAvatar = avatar ? true : avatar === null ? false : !!initial?.avatarPhotoId;

  const pick = async (file: File) => {
    setError(undefined);
    setBusy(true);
    try {
      setAvatar(await processPhoto(file));
    } catch {
      setError(t.photoError);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileNameValid(name)) return setNameError(t.nameRequired);
    setNameError(undefined);
    setBusy(true);
    try {
      await saveProfile({ name: name.trim(), bio: bio.trim() }, avatar);
      void navigate('/profil');
    } catch {
      setError(t.saveError);
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <div className={styles.avatarEdit}>
        {avatar ? (
          <Avatar blob={avatar.thumb} size={96} />
        ) : (
          <Avatar photoId={avatar === null ? undefined : initial?.avatarPhotoId} size={96} />
        )}
        <div className={photoStyles.buttons}>
          <label className={photoStyles.fileLabel} aria-disabled={busy || undefined}>
            {t.chooseAvatar}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void pick(f);
              }}
            />
          </label>
          {hasAvatar && (
            <Button variant="ghost" onClick={() => setAvatar(null)} disabled={busy}>
              {t.removeAvatar}
            </Button>
          )}
        </div>
      </div>
      <TextField
        label={t.nameLabel}
        value={name}
        maxLength={PROFILE_NAME_MAX}
        autoComplete="nickname"
        error={nameError}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label={t.bioLabel}
        hint={t.bioHint}
        value={bio}
        rows={4}
        maxLength={PROFILE_BIO_MAX}
        onChange={(e) => setBio(e.target.value)}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button type="submit" disabled={busy}>
          {t.save}
        </Button>
        <Button variant="secondary" onClick={() => void navigate('/profil')}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export function EditProfilePage() {
  const profile = useProfile();
  return (
    <Page title={t.editTitle} back="/profil">
      {profile === undefined ? <Notice>{t.loading}</Notice> : <Form initial={profile} />}
    </Page>
  );
}
