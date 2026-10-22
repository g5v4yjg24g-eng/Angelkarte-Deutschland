// Fang, Fischkontakt, Fehlbiss oder Beobachtung erfassen bzw. bearbeiten (M5.1).
// Erst das Nötigste (was, welche Art, wann); alles Weitere unter „Mehr Details".
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { SelectField, TextArea, TextField } from '../../design/components/Field';
import { getDb } from '../../data/db';
import { saveCatch } from '../../data/catchService';
import { repo } from '../../data/repository';
import { isQuotaError, userMessage } from '../../data/errors';
import { MAX_PHOTOS_PER_CATCH } from '../../domain/photo';
import { newId } from '../../domain/id';
import { PhotoReadError, processPhoto } from '../../lib/processPhoto';
import { PhotoPicker, type PendingPhoto } from './PhotoPicker';
import { useRunningSession } from '../sessions/useSessions';
import { covers } from '../../domain/session';
import {
  BaitTypeSchema,
  CatchOutcomeSchema,
  MethodSchema,
  type Catch,
  type CatchOutcome,
} from '../../domain/schemas';
import { SPECIES, speciesById } from '../../domain/species';
import type { WaterType } from '../../domain/water';
import { normName, presetByName, sortPresets } from '../../domain/baitPreset';
import {
  applyPreset,
  draftFromCatch,
  draftToFields,
  emptyDraft,
  recentBaits,
  recentSpecies,
  type CatchDraft,
  type DraftErrors,
  type DraftField,
} from '../../domain/catchDraft';
import { markerDataUrl } from '../map/markerIcons';
import { LawCheckPanel } from '../law/LawCheckPanel';
import { useLawCheck, useStateResolution } from '../law/useLawCheck';
import type { StateCode } from '../../domain/water';
import styles from './CatchForm.module.css';

const t = de.catchForm;

/** Ort und Bezüge eines neuen Eintrags (kommen von der Karte, einem Ort oder dem Gewässerprofil). */
export interface WaterChoice {
  wid: string;
  name?: string;
  /** Gemeinde, sonst Kreis */
  place?: string | undefined;
  type?: WaterType;
}
export interface CatchContext {
  position?: NonNullable<Catch['position']>;
  water?: WaterChoice;
  /** Mehrere Gewässer in der Nähe: zur Auswahl (M5.5) */
  waterOptions?: WaterChoice[];
  placeId?: string;
}

const SPECIES_OPTIONS = [
  { value: '', label: t.speciesNone },
  ...[...SPECIES]
    .filter((s) => s.id !== 'other')
    .sort((a, b) => a.de.localeCompare(b.de, 'de'))
    .map((s) => ({ value: s.id, label: s.de })),
  { value: 'other', label: speciesById('other')?.de ?? 'Andere Art' },
];
const METHOD_OPTIONS = [
  { value: '' as const, label: t.noChoice },
  ...MethodSchema.options.map((m) => ({ value: m, label: t.methods[m] })),
];
const BAIT_TYPE_OPTIONS = [
  { value: '' as const, label: t.noChoice },
  ...BaitTypeSchema.options.map((b) => ({ value: b, label: t.baitTypes[b] })),
];
const optionsOf = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

// Felder unter „Mehr Details": bei einem Fehler dort wird der Bereich aufgeklappt
const DETAIL_FIELDS: DraftField[] = ['lengthCm', 'weightKg', 'baitName', 'airTempC', 'waterTempC', 'windBft'];

export function CatchForm({
  initial,
  context,
  myLocation,
  onSaved,
  onCancel,
}: {
  /** Bestehender Eintrag (Bearbeiten) */
  initial?: Catch;
  context?: CatchContext;
  /** Aktueller Standort, falls die Standortanzeige gerade eingeschaltet ist */
  myLocation?: { lat: number; lng: number; accuracy: number };
  onSaved: (c: Catch) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CatchDraft>(() =>
    initial ? draftFromCatch(initial) : emptyDraft(Date.now()),
  );
  const [position, setPosition] = useState(initial ? initial.position : context?.position);
  // Gewählte Zuordnung bei mehreren nahen Gewässern ('' = keins)
  const [waterWid, setWaterWid] = useState(context?.water?.wid ?? '');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [quotaFull, setQuotaFull] = useState(false);
  const existingPhotos = (initial?.photoIds ?? []).filter((id) => !removedPhotos.includes(id));
  // Neue Einträge gehören zur laufenden Session, wenn ihr Zeitpunkt in die Session fällt (M5.4)
  const running = useRunningSession();

  async function addPhotos(files: File[]) {
    setPhotoError(undefined);
    setProcessing(true);
    const room = MAX_PHOTOS_PER_CATCH - existingPhotos.length - pending.length;
    const added: PendingPhoto[] = [];
    for (const f of files.slice(0, Math.max(0, room)))
      try {
        added.push({ key: newId(), photo: await processPhoto(f) });
      } catch (err) {
        setPhotoError(err instanceof PhotoReadError ? t.photoUnreadable : userMessage(err));
      }
    if (files.length > room) setPhotoError(t.photoLimit(MAX_PHOTOS_PER_CATCH));
    setPending((p) => [...p, ...added]);
    setProcessing(false);
  }
  const details = useRef<HTMLDetailsElement>(null);

  const all = useLiveQuery(() => getDb().catches.toArray(), []);
  const recent = useMemo(() => recentSpecies(all ?? []), [all]);
  const presets = useLiveQuery(() => getDb().baitPresets.toArray(), []);
  const favorites = useMemo(() => sortPresets(presets ?? []), [presets]);
  // Zuletzt benutzte Köder, die schon Favoriten sind, nicht doppelt zeigen
  const baits = useMemo(
    () => recentBaits(all ?? []).filter((b) => !presetByName(favorites, b.name)),
    [all, favorites],
  );
  const chosenPreset = favorites.find((p) => p.id === draft.baitPresetId);
  const canSaveFavorite = !!draft.baitName.trim() && !presetByName(favorites, draft.baitName);

  async function saveFavorite() {
    const name = draft.baitName.trim().replace(/\s+/g, ' ');
    const p = await repo('baitPresets').create({
      label: name,
      bait: { name, ...(draft.baitType ? { type: draft.baitType } : {}) },
      ...(draft.method ? { method: draft.method } : {}),
    });
    setDraft((d) => ({ ...d, baitPresetId: p.id }));
  }

  const set = <K extends DraftField>(k: K, v: CatchDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([f]) => f !== k)));
  };
  const errorText = (k: DraftField) => {
    const e = errors[k];
    if (!e) return undefined;
    if (e === 'number') return t.errors.number;
    if (e === 'date') return t.errors.date;
    return (t.errors.range as Partial<Record<DraftField, string>>)[k] ?? t.errors.summary;
  };
  const numberProps = (k: DraftField) => ({
    inputMode: 'decimal' as const,
    value: draft[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    error: errorText(k),
  });

  const caught = draft.outcome === 'caught';
  const sized = caught || draft.outcome === 'contact';
  const options = context?.waterOptions ?? [];
  const chosenWater = options.length > 1 ? options.find((o) => o.wid === waterWid) : context?.water;
  const water = initial
    ? initial.waterSnapshot?.name
      ? { name: initial.waterSnapshot.name }
      : undefined
    : chosenWater;

  // Rechts-Warnung: Bundesland am Fangort (oder in Grenznähe gewählt) und Prüfung der aktuellen Angaben
  const posKey = (p?: { lat: number; lng: number }) => (p ? `${p.lat},${p.lng}` : '');
  const [stateChoice, setStateChoice] = useState<{ key: string; code: StateCode } | undefined>(() =>
    initial?.stateCode ? { key: posKey(initial.position), code: initial.stateCode } : undefined,
  );
  const fixedState = stateChoice?.key === posKey(position) ? stateChoice.code : undefined;
  const resolution = useStateResolution(position, fixedState);
  const lawInput = useMemo(() => {
    const { fields } = draftToFields(draft, initial ? { base: initial } : {});
    return fields ?? { outcome: draft.outcome, at: '' };
  }, [draft, initial]);
  const lawCheck = useLawCheck(lawInput, lawInput.at ? resolution : { kind: 'unknown' });

  async function save(e?: React.FormEvent, { withPhotos = true } = {}) {
    e?.preventDefault();
    setSaveError(undefined);
    setQuotaFull(false);
    const { fields, errors: errs } = draftToFields(draft, {
      ...(initial ? { base: initial } : {}),
      ...(chosenPreset ? { preset: chosenPreset } : {}),
    });
    if (!fields) {
      setErrors(errs);
      if (details.current && DETAIL_FIELDS.some((f) => errs[f])) details.current.open = true;
      return;
    }
    const resolvedState = resolution?.kind === 'state' ? resolution.code : undefined;
    setBusy(true);
    try {
      const addPhotos = withPhotos ? pending.map((p) => p.photo) : [];
      const saved = initial
        ? await saveCatch({
            id: initial.id,
            changes: { ...fields, position, stateCode: resolvedState },
            addPhotos,
            removePhotoIds: removedPhotos,
          })
        : await saveCatch({
            input: {
              ...fields,
              ...(position ? { position } : {}),
              ...(resolvedState ? { stateCode: resolvedState } : {}),
              ...(chosenWater
                ? {
                    waterId: chosenWater.wid,
                    waterSnapshot: {
                      ...(chosenWater.name ? { name: chosenWater.name } : {}),
                      ...(chosenWater.place ? { place: chosenWater.place } : {}),
                    },
                  }
                : {}),
              ...(context?.placeId ? { placeId: context.placeId } : {}),
              ...(running && covers(running, fields.at) ? { sessionId: running.id } : {}),
            },
            addPhotos,
          });
      onSaved(saved);
    } catch (err) {
      console.error(err);
      // Speicher voll: nichts wurde gespeichert (eine Transaktion); ohne Fotos geht es meist trotzdem (CAT-5)
      if (isQuotaError(err) && withPhotos && pending.length) setQuotaFull(true);
      else setSaveError(userMessage(err));
      setBusy(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  const openDetails =
    !!initial &&
    !!(
      initial.lengthCm ??
      initial.weightG ??
      initial.method ??
      initial.bait?.name ??
      initial.conditions?.sky ??
      initial.contactDetail ??
      initial.released
    );

  return (
    <form onSubmit={(e) => void save(e)} className={styles.form} noValidate>
      <fieldset className={styles.outcomes}>
        <legend>{t.outcome}</legend>
        {CatchOutcomeSchema.options.map((o: CatchOutcome) => (
          <label key={o} className={styles.outcome}>
            <input
              type="radio"
              name="outcome"
              value={o}
              checked={draft.outcome === o}
              onChange={() => set('outcome', o)}
            />
            <span>
              <img src={markerDataUrl(`catch-${o}`)} width={28} height={28} alt="" aria-hidden="true" />
              <span>
                <strong>{de.map.outcomes[o]}</strong>
                <small>{t.outcomeHints[o]}</small>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {draft.outcome !== 'missed_bite' && (
        <div className={styles.species}>
          {recent.length > 0 && (
            <div className={styles.chips} role="group" aria-label={`${t.species}: ${t.speciesRecent}`}>
              {recent.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={draft.speciesId === id}
                  onClick={() => set('speciesId', draft.speciesId === id ? '' : id)}
                >
                  {speciesById(id)?.de ?? id}
                </button>
              ))}
            </div>
          )}
          <SelectField
            label={t.species}
            options={SPECIES_OPTIONS}
            value={draft.speciesId}
            onChange={(e) => set('speciesId', e.target.value)}
          />
        </div>
      )}

      <div className={styles.pair}>
        <TextField
          label={t.date}
          type="date"
          required
          value={draft.date}
          onChange={(e) => set('date', e.target.value)}
          error={errorText('date')}
        />
        <TextField
          label={t.time}
          type="time"
          required
          value={draft.time}
          onChange={(e) => set('time', e.target.value)}
        />
      </div>

      <PhotoPicker
        existingIds={existingPhotos}
        pending={pending}
        processing={processing}
        error={photoError}
        onPick={(files) => void addPhotos(files)}
        onRemoveExisting={(id) => setRemovedPhotos((r) => [...r, id])}
        onRemovePending={(key) => setPending((p) => p.filter((x) => x.key !== key))}
      />

      <div className={styles.where}>
        <p>
          <strong>{t.position}: </strong>
          {position ? (
            <>
              {t.positionSource[position.source]}{' '}
              <span className="muted tabular">{de.map.coords(position.lat, position.lng)}</span>
            </>
          ) : (
            t.positionNone
          )}
        </p>
        {myLocation && position?.source !== 'gps' && (
          <Button
            variant="secondary"
            onClick={() =>
              setPosition({
                lat: myLocation.lat,
                lng: myLocation.lng,
                accuracyM: Math.round(myLocation.accuracy),
                source: 'gps',
              })
            }
          >
            {t.useMyLocation}
          </Button>
        )}
        {!initial && options.length > 1 ? (
          <SelectField
            label={t.waterChoose}
            options={[
              ...options.map((o) => ({
                value: o.wid,
                label: o.type
                  ? t.waterOption(o.name ?? de.water.unnamed, de.water.types[o.type])
                  : (o.name ?? de.water.unnamed),
              })),
              { value: '', label: t.waterNone },
            ]}
            value={waterWid}
            onChange={(e) => setWaterWid(e.target.value)}
          />
        ) : (
          <p>
            <strong>{t.water}: </strong>
            {water ? (water.name ?? de.water.unnamed) : <span className="muted">{t.waterUnknown}</span>}
          </p>
        )}
      </div>

      {!initial && running && (
        <p className="muted">{de.sessions.assignHint(running.startAt.slice(11, 16))}</p>
      )}

      <details ref={details} className={styles.details} open={openDetails || undefined}>
        <summary>{t.more}</summary>
        <div className={styles.detailBody}>
          {sized && (
            <fieldset className={styles.group}>
              <legend>{t.size}</legend>
              <TextField label={t.length} {...numberProps('lengthCm')} />
              {caught ? (
                <SegmentedControl
                  label={t.lengthMethod}
                  options={[
                    { value: 'measured', label: t.measured },
                    { value: 'estimated', label: t.estimated },
                  ]}
                  value={draft.lengthMethod}
                  onChange={(v) => set('lengthMethod', v)}
                />
              ) : (
                <p className="muted">{t.estimatedOnlyHint}</p>
              )}
              <TextField label={t.weight} {...numberProps('weightKg')} />
              {caught && (
                <SegmentedControl
                  label={t.weightMethod}
                  options={[
                    { value: 'weighed', label: t.weighed },
                    { value: 'estimated', label: t.estimated },
                  ]}
                  value={draft.weightMethod}
                  onChange={(v) => set('weightMethod', v)}
                />
              )}
              {caught && (
                <SelectField
                  label={t.released}
                  options={optionsOf(t.releasedOptions)}
                  value={draft.released}
                  onChange={(e) => set('released', e.target.value as CatchDraft['released'])}
                />
              )}
            </fieldset>
          )}
          {draft.outcome === 'contact' && (
            <SelectField
              label={t.contactDetail}
              options={optionsOf(t.contactDetails)}
              value={draft.contactDetail}
              onChange={(e) => set('contactDetail', e.target.value as CatchDraft['contactDetail'])}
            />
          )}

          <fieldset className={styles.group}>
            <legend>{t.tackle}</legend>
            <SelectField
              label={t.method}
              options={METHOD_OPTIONS}
              value={draft.method}
              onChange={(e) => set('method', e.target.value as CatchDraft['method'])}
            />
            {favorites.length > 0 && (
              <div className={styles.chips} role="group" aria-label={t.baitFavorites}>
                {favorites.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={
                      draft.baitPresetId === p.id &&
                      normName(draft.baitName) === normName(p.bait.name ?? p.label)
                    }
                    onClick={() => setDraft((d) => applyPreset(d, p))}
                  >
                    <span aria-hidden="true">★</span> {p.label}
                  </button>
                ))}
              </div>
            )}
            {baits.length > 0 && (
              <div className={styles.chips} role="group" aria-label={t.baitRecent}>
                {baits.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    className={styles.chip}
                    aria-pressed={draft.baitName === b.name}
                    onClick={() => {
                      set('baitName', b.name);
                      if (b.type) set('baitType', b.type);
                    }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
            <TextField
              label={t.bait}
              placeholder={t.baitPlaceholder}
              maxLength={120}
              value={draft.baitName}
              onChange={(e) => set('baitName', e.target.value)}
              error={errorText('baitName')}
            />
            <SelectField
              label={t.baitType}
              options={BAIT_TYPE_OPTIONS}
              value={draft.baitType}
              onChange={(e) => set('baitType', e.target.value as CatchDraft['baitType'])}
            />
            {canSaveFavorite && (
              <Button type="button" variant="secondary" onClick={() => void saveFavorite()}>
                {t.saveFavorite}
              </Button>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{t.conditions}</legend>
            <SelectField
              label={t.sky}
              options={optionsOf(t.skies)}
              value={draft.sky}
              onChange={(e) => set('sky', e.target.value as CatchDraft['sky'])}
            />
            <div className={styles.pair}>
              <TextField label={t.airTemp} {...numberProps('airTempC')} />
              <TextField label={t.waterTemp} {...numberProps('waterTempC')} />
            </div>
            <TextField label={t.wind} {...numberProps('windBft')} inputMode="numeric" />
          </fieldset>
        </div>
      </details>

      <TextArea
        label={t.notes}
        maxLength={4000}
        value={draft.notes}
        onChange={(e) => set('notes', e.target.value)}
        error={errorText('notes')}
      />

      <LawCheckPanel
        check={lawCheck}
        hasPosition={!!position}
        onChooseState={(code) => setStateChoice({ key: posKey(position), code })}
      />

      {hasErrors && <Notice tone="error">{t.errors.summary}</Notice>}
      {saveError && <Notice tone="error">{saveError}</Notice>}
      {quotaFull && (
        <Notice tone="error">
          <strong>{t.quotaTitle}</strong> {t.quotaText}
          <span className={styles.noticeAction}>
            <Button variant="secondary" onClick={() => void save(undefined, { withPhotos: false })}>
              {t.saveWithoutPhotos}
            </Button>
          </span>
        </Notice>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy || processing}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}
