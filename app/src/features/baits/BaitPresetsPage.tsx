// Köder-Favoriten verwalten (P1): anlegen, bearbeiten, löschen mit „Rückgängig".
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { SelectField, TextField } from '../../design/components/Field';
import { HookIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { userMessage } from '../../data/errors';
import { BaitTypeSchema, MethodSchema, type BaitPreset } from '../../domain/schemas';
import {
  emptyPresetDraft,
  presetDraftFrom,
  presetDraftToFields,
  sortPresets,
  type PresetDraft,
  type PresetErrors,
  type PresetField,
} from '../../domain/baitPreset';
import styles from './BaitPresetsPage.module.css';

const t = de.baits;
const f = de.catchForm;

const TYPE_OPTIONS = [
  { value: '' as const, label: f.noChoice },
  ...BaitTypeSchema.options.map((b) => ({ value: b, label: f.baitTypes[b] })),
];
const METHOD_OPTIONS = [
  { value: '' as const, label: f.noChoice },
  ...MethodSchema.options.map((m) => ({ value: m, label: f.methods[m] })),
];

function summary(p: BaitPreset): string {
  return [
    p.bait.type && f.baitTypes[p.bait.type],
    p.bait.color,
    f.baitDetails(p.bait),
    p.method && f.methods[p.method],
  ]
    .filter(Boolean)
    .join(' · ');
}

function PresetForm({
  initial,
  others,
  onDone,
}: {
  initial?: BaitPreset;
  others: BaitPreset[];
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<PresetDraft>(() =>
    initial ? presetDraftFrom(initial) : emptyPresetDraft(),
  );
  const [errors, setErrors] = useState<PresetErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = <K extends PresetField>(k: K, v: PresetDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([x]) => x !== k)));
  };
  const err = (k: PresetField) => (errors[k] ? t.errors[errors[k]] : undefined);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { fields, errors: errs } = presetDraftToFields(draft, others);
    if (!fields) return setErrors(errs);
    setBusy(true);
    try {
      if (initial) await repo('baitPresets').update(initial.id, { ...fields, method: fields.method });
      else await repo('baitPresets').create(fields);
      onDone();
    } catch (x) {
      setSaveError(userMessage(x));
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => void save(e)}
      noValidate
      aria-label={initial ? t.editTitle : t.newTitle}
    >
      <h2 className={styles.formTitle}>{initial ? t.editTitle : t.newTitle}</h2>
      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        maxLength={120}
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        error={err('name')}
        autoFocus
      />
      <SelectField
        label={f.baitType}
        options={TYPE_OPTIONS}
        value={draft.type}
        onChange={(e) => set('type', e.target.value as PresetDraft['type'])}
      />
      <TextField
        label={t.color}
        maxLength={60}
        value={draft.color}
        onChange={(e) => set('color', e.target.value)}
        error={err('color')}
      />
      <div className={styles.row}>
        <TextField
          label={t.sizeCm}
          inputMode="decimal"
          value={draft.sizeCm}
          onChange={(e) => set('sizeCm', e.target.value)}
          error={err('sizeCm')}
        />
        <TextField
          label={t.weightG}
          inputMode="decimal"
          value={draft.weightG}
          onChange={(e) => set('weightG', e.target.value)}
          error={err('weightG')}
        />
      </div>
      <TextField
        label={t.hookSize}
        placeholder={t.hookPlaceholder}
        maxLength={20}
        value={draft.hookSize}
        onChange={(e) => set('hookSize', e.target.value)}
        error={err('hookSize')}
      />
      <SelectField
        label={f.method}
        options={METHOD_OPTIONS}
        value={draft.method}
        onChange={(e) => set('method', e.target.value as PresetDraft['method'])}
      />
      {saveError && <Notice tone="error">{saveError}</Notice>}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}

export function BaitPresetsPage() {
  const all = useLiveQuery(() => getDb().baitPresets.toArray(), []);
  const usage = useLiveQuery(async () => {
    const n = new Map<string, number>();
    await getDb().catches.each((c) => {
      if (!c.deletedAt && c.baitPresetId) n.set(c.baitPresetId, (n.get(c.baitPresetId) ?? 0) + 1);
    });
    return n;
  }, []);
  const presets = useMemo(() => sortPresets(all ?? []), [all]);
  // 'new' = neuer Favorit, sonst id des bearbeiteten
  const [editing, setEditing] = useState<string>();
  const [toast, setToast] = useState<{ text: string; undoId?: string }>();

  if (!all)
    return (
      <Page title={t.title} back="/mehr">
        <Notice>{t.loading}</Notice>
      </Page>
    );

  const editingPreset = presets.find((p) => p.id === editing);
  const form = editing && (
    <PresetForm
      key={editing}
      {...(editingPreset ? { initial: editingPreset } : {})}
      others={presets.filter((p) => p.id !== editing)}
      onDone={() => setEditing(undefined)}
    />
  );

  async function remove(p: BaitPreset) {
    await repo('baitPresets').remove(p.id);
    setToast({ text: t.deleted(p.label), undoId: p.id });
  }

  return (
    <Page title={t.title} back="/mehr">
      <p className="muted">{t.intro}</p>
      {editing === 'new' ? form : <Button onClick={() => setEditing('new')}>{t.add}</Button>}
      {presets.length === 0 && editing !== 'new' ? (
        <EmptyState icon={<HookIcon size={32} />} title={t.emptyTitle}>
          {t.emptyText}
        </EmptyState>
      ) : (
        <ul className={styles.list} aria-label={t.title}>
          {presets.map((p) =>
            editing === p.id ? (
              <li key={p.id}>{form}</li>
            ) : (
              <li key={p.id} className={styles.item}>
                <div className={styles.text}>
                  <p className={styles.name}>{p.label}</p>
                  {summary(p) && <p className="muted">{summary(p)}</p>}
                  {(usage?.get(p.id) ?? 0) > 0 && <p className="muted">{t.used(usage?.get(p.id) ?? 0)}</p>}
                </div>
                <div className={styles.itemActions}>
                  <Button
                    variant="secondary"
                    onClick={() => setEditing(p.id)}
                    aria-label={`${p.label}: ${t.edit}`}
                  >
                    {t.edit}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void remove(p)}
                    aria-label={`${p.label}: ${t.delete}`}
                  >
                    {t.delete}
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {toast && (
        <Toast
          onDismiss={() => setToast(undefined)}
          actions={
            toast.undoId && (
              <Button
                variant="ghost"
                onClick={() => {
                  const id = toast.undoId ?? '';
                  void repo('baitPresets')
                    .restore(id)
                    .then(() => setToast({ text: t.restored }));
                }}
              >
                {t.undo}
              </Button>
            )
          }
        >
          {toast.text}
        </Toast>
      )}
    </Page>
  );
}
