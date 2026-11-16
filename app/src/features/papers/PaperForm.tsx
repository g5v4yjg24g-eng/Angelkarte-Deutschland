// Papier anlegen oder bearbeiten (Sheet): Art, Bezeichnung, Gültigkeit, Erinnerung, Fotos. Speichern über
// data/paperService.ts; danach wird – nur in der iPhone-App – einmal um die Erlaubnis für Mitteilungen gebeten.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Sheet } from '../../design/components/Sheet';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Switch } from '../../design/components/Switch';
import { SelectField, TextArea, TextField } from '../../design/components/Field';
import { savePaper } from '../../data/paperService';
import { userMessage } from '../../data/errors';
import {
  PAPER_KINDS,
  emptyPaperDraft,
  paperDraftFrom,
  paperDraftToFields,
  type PaperDraft,
  type PaperErrors,
  type PaperField,
} from '../../domain/papers';
import { MAX_PHOTOS_PER_PAPER, type Paper } from '../../domain/schemas';
import { newId } from '../../domain/id';
import { PhotoReadError, processPhoto } from '../../lib/processPhoto';
import { useProviders } from '../../ports/providersContext';
import { PhotoPicker, type PendingPhoto } from '../catches/PhotoPicker';
import styles from './Papers.module.css';

const t = de.papers.form;
const KIND_OPTIONS = PAPER_KINDS.map((k) => ({ value: k, label: de.papers.kinds[k] }));

export function PaperForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Paper | undefined;
  onClose: () => void;
  onSaved: (p: Paper) => void;
}) {
  const { reminders } = useProviders();
  const [draft, setDraft] = useState<PaperDraft>(() =>
    initial ? paperDraftFrom(initial) : emptyPaperDraft(),
  );
  const [errors, setErrors] = useState<PaperErrors>({});
  const [existing, setExisting] = useState<string[]>(initial?.photoIds ?? []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PaperDraft>(k: K, v: PaperDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (k in errors) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([x]) => x !== k)));
  };
  const err = (k: PaperField) => (errors[k] ? t.errors[errors[k]] : undefined);

  async function addPhotos(files: File[]) {
    setPhotoError(undefined);
    setProcessing(true);
    const room = MAX_PHOTOS_PER_PAPER - existing.length - pending.length;
    const added: PendingPhoto[] = [];
    try {
      for (const f of files.slice(0, Math.max(0, room)))
        added.push({ key: newId(), photo: await processPhoto(f) });
    } catch (e) {
      setPhotoError(e instanceof PhotoReadError ? de.catchForm.photoUnreadable : userMessage(e));
    }
    setPending((p) => [...p, ...added]);
    setProcessing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { fields, errors: errs } = paperDraftToFields(draft);
    if (!fields) return setErrors(errs);
    setBusy(true);
    try {
      const addPhotos = pending.map((p) => p.photo);
      const saved = await savePaper(
        initial
          ? { id: initial.id, changes: fields, addPhotos, removePhotoIds: removed }
          : { input: fields, addPhotos },
      );
      // Erst nach dem Speichern um die Erlaubnis für Mitteilungen bitten – nur wenn es etwas zu erinnern gibt
      if (reminders && fields.validUntil && fields.remind && (await reminders.permission()) === 'prompt')
        await reminders.request();
      onSaved(saved);
    } catch (x) {
      setSaveError(userMessage(x));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      title={initial ? t.editTitle : t.newTitle}
      onClose={onClose}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form="paper-form" disabled={busy || processing}>
            {t.save}
          </Button>
        </div>
      }
    >
      <form id="paper-form" className={styles.form} onSubmit={(e) => void save(e)} noValidate>
        <SelectField
          label={t.kind}
          options={KIND_OPTIONS}
          value={draft.kind}
          onChange={(e) => {
            const kind = e.target.value as PaperDraft['kind'];
            // Beim Wechsel zum Fischereischein ist „unbefristet“ der übliche Fall – nur solange noch nichts eingetragen ist
            setDraft((d) => ({
              ...d,
              kind,
              unlimited: !d.validUntil && kind === 'license' ? true : d.unlimited,
            }));
          }}
        />
        <TextField
          label={t.name}
          placeholder={t.namePlaceholder}
          maxLength={120}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          error={err('title')}
        />
        <TextField
          label={t.issuer}
          maxLength={120}
          value={draft.issuer}
          onChange={(e) => set('issuer', e.target.value)}
        />
        <TextField
          label={t.number}
          maxLength={60}
          value={draft.number}
          onChange={(e) => set('number', e.target.value)}
        />
        <div className={styles.switchRow}>
          <span id="paper-unlimited">{t.unlimited}</span>
          <Switch label={t.unlimited} checked={draft.unlimited} onChange={(v) => set('unlimited', v)} />
        </div>
        <div className={styles.row}>
          <TextField
            label={t.validFrom}
            type="date"
            value={draft.validFrom}
            onChange={(e) => set('validFrom', e.target.value)}
            error={err('validFrom')}
          />
          {!draft.unlimited && (
            <TextField
              label={t.validUntil}
              type="date"
              value={draft.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
              error={err('validUntil')}
            />
          )}
        </div>
        {!draft.unlimited && (
          <div className={styles.switchRow}>
            <span>{t.remind}</span>
            <Switch label={t.remind} checked={draft.remind} onChange={(v) => set('remind', v)} />
          </div>
        )}
        <TextArea
          label={t.notes}
          maxLength={2000}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
        <PhotoPicker
          existingIds={existing}
          pending={pending}
          processing={processing}
          error={photoError}
          max={MAX_PHOTOS_PER_PAPER}
          onPick={(files) => void addPhotos(files)}
          onRemoveExisting={(id) => {
            setExisting((x) => x.filter((p) => p !== id));
            setRemoved((x) => [...x, id]);
          }}
          onRemovePending={(key) => setPending((p) => p.filter((x) => x.key !== key))}
        />
        {saveError && <Notice tone="error">{saveError}</Notice>}
      </form>
    </Sheet>
  );
}
