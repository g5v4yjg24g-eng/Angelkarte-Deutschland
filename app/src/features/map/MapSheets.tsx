// Inhalte der Bottom Sheets auf der Karte: neu anlegen, Ort ansehen/bearbeiten, Fang ansehen, Legende, Standort.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextArea, TextField } from '../../design/components/Field';
import { userMessage } from '../../data/errors';
import { repo } from '../../data/repository';
import type { Catch, Place, PlaceType } from '../../domain/schemas';
import { CatchFacts, CatchHead } from '../catches/CatchFacts';
import { formatDateTime } from '../../lib/storage';
import { CATCH_OUTCOMES, markerDataUrl, PLACE_TYPES } from './markerIcons';
import styles from './MapView.module.css';

const Icon = ({ kind }: { kind: Parameters<typeof markerDataUrl>[0] }) => (
  <img src={markerDataUrl(kind)} width={28} height={28} alt="" aria-hidden="true" />
);

export function NewHere({
  lat,
  lng,
  waterName,
  onPick,
  onCatch,
}: {
  lat: number;
  lng: number;
  waterName?: string;
  onPick: (t: PlaceType) => void;
  onCatch: () => void;
}) {
  return (
    <>
      <p className="muted tabular">
        {waterName ? `${waterName} · ` : ''}
        {de.map.coords(lat, lng)}
      </p>
      <div className={styles.typeGrid}>
        {PLACE_TYPES.map((t) => (
          <button key={t} type="button" className={styles.typeButton} onClick={() => onPick(t)}>
            <Icon kind={`place-${t}`} />
            <span>{de.map.placeTypes[t]}</span>
          </button>
        ))}
      </div>
      <button type="button" className={[styles.typeButton, styles.catchButton].join(' ')} onClick={onCatch}>
        <Icon kind="catch-caught" />
        <span>{de.map.addCatch}</span>
      </button>
    </>
  );
}

/** Formular für neue und bestehende Orte. */
export function PlaceForm({
  initial,
  water,
  lat,
  lng,
  onSaved,
  onCancel,
}: {
  initial: Pick<Place, 'type'> & Partial<Place>;
  /** Gewässer, an dem der Ort liegt (aus der Gewässerebene) */
  water?: { wid: string; name?: string };
  lat: number;
  lng: number;
  onSaved: (p: Place) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<PlaceType>(initial.type);
  const [name, setName] = useState(initial.name ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const fields = {
      type,
      ...(name.trim() ? { name: name.trim() } : { name: undefined }),
      ...(notes.trim() ? { notes: notes.trim() } : { notes: undefined }),
    };
    try {
      const r = repo('places');
      const p = initial.id
        ? await r.update(initial.id, fields as Partial<Place>)
        : await r.create({
            ...fields,
            position: { lat, lng, source: 'map-tap' },
            ...(water ? { waterId: water.wid, waterSnapshot: water.name ? { name: water.name } : {} } : {}),
          } as Parameters<typeof r.create>[0]);
      onSaved(p);
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className={styles.form} noValidate>
      <fieldset className={styles.typeChips}>
        <legend>{de.map.type}</legend>
        {PLACE_TYPES.map((t) => (
          <label key={t} className={styles.chip}>
            <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
            <span>
              <Icon kind={`place-${t}`} />
              {de.map.placeTypes[t]}
            </span>
          </label>
        ))}
      </fieldset>
      <TextField
        label={de.map.name}
        placeholder={de.map.namePlaceholder}
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label={de.map.notes}
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <p className="muted tabular">{de.map.coords(lat, lng)}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button variant="secondary" onClick={onCancel}>
          {de.map.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {de.map.save}
        </Button>
      </div>
    </form>
  );
}

export function PlaceDetails({
  place,
  onEdit,
  onDelete,
  onAddCatch,
}: {
  place: Place;
  onEdit: () => void;
  onDelete: () => void;
  onAddCatch: () => void;
}) {
  return (
    <>
      <div className={styles.detailHead}>
        <Icon kind={`place-${place.type}`} />
        <div>
          <p className={styles.detailTitle}>{place.name ?? de.map.unnamed}</p>
          <p className="muted">{de.map.placeTypes[place.type]}</p>
        </div>
      </div>
      {place.notes && <p className={styles.notes}>{place.notes}</p>}
      <p className="muted tabular">{de.map.coords(place.position.lat, place.position.lng)}</p>
      <p className="muted">{de.map.createdAt(formatDateTime(place.createdAt))}</p>
      <Button variant="secondary" onClick={onAddCatch}>
        {de.map.addCatchHere}
      </Button>
      <div className={styles.formActions}>
        <Button variant="danger" onClick={onDelete}>
          {de.map.delete}
        </Button>
        <Button onClick={onEdit}>{de.map.edit}</Button>
      </div>
    </>
  );
}

export function CatchDetails({
  item,
  onEdit,
  onDelete,
}: {
  item: Catch;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.form}>
      <CatchHead item={item} />
      <CatchFacts item={item} />
      <div className={styles.formActions}>
        <Button variant="danger" onClick={onDelete}>
          {de.map.delete}
        </Button>
        <Button onClick={onEdit}>{de.map.edit}</Button>
      </div>
    </div>
  );
}

export function Legend({ clustersLabeled }: { clustersLabeled: boolean }) {
  return (
    <>
      <h3 className={styles.legendHead}>{de.map.legendPlaces}</h3>
      <ul className={styles.legend}>
        {PLACE_TYPES.map((t) => (
          <li key={t}>
            <Icon kind={`place-${t}`} />
            {de.map.placeTypes[t]}
          </li>
        ))}
      </ul>
      <h3 className={styles.legendHead}>{de.map.legendCatches}</h3>
      <ul className={styles.legend}>
        {CATCH_OUTCOMES.map((o) => (
          <li key={o}>
            <Icon kind={`catch-${o}`} />
            {de.map.outcomes[o]}
          </li>
        ))}
      </ul>
      {clustersLabeled && <p className="muted">{de.map.legendClusterHint}</p>}
    </>
  );
}
