// Inhalte der Bottom Sheets auf der Karte: neu anlegen, Ort ansehen/bearbeiten, Fang ansehen, Legende, Standort.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Switch } from '../../design/components/Switch';
import { useProviders } from '../../ports/providersContext';
import { TextArea, TextField } from '../../design/components/Field';
import { userMessage } from '../../data/errors';
import { repo } from '../../data/repository';
import type { Catch, Place, PlaceType } from '../../domain/schemas';
import { CatchFacts } from '../catches/CatchFacts';
import { EntryHead, EntryTiles, NoteCard, RowCard } from './EntryView';
import { CATCH_OUTCOMES, markerDataUrl, PLACE_TYPES } from './markerIcons';
import { ALL_LAYERS, isFiltered, type MapFilter, type MapLayerKey } from '../../domain/mapFilter';
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
  const { account } = useProviders();
  // Spots mit Freunden teilen: standardmäßig an (nur sichtbar mit Konto)
  const [shared, setShared] = useState(initial.sharedWithFriends !== false);
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
      ...(account.enabled ? { sharedWithFriends: shared } : {}),
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
      {account.enabled && (
        <div className={styles.sharedRow}>
          <span>{de.map.sharedWithFriends}</span>
          <Switch checked={shared} onChange={setShared} label={de.map.sharedWithFriends} />
        </div>
      )}
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

/** Kopf des Ort-Blatts (Kopfkarte am `Sheet`): Symbol im Kreis, Bezeichnung, Art · angelegt am */
export function PlaceHead({ place }: { place: Place }) {
  return (
    <EntryHead icon={`place-${place.type}`} title={place.name ?? de.map.unnamed}>
      {de.map.placeTypes[place.type]} ·{' '}
      {de.map.createdAt(new Date(place.createdAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }))}
    </EntryHead>
  );
}

export function PlaceDetails({
  place,
  onAddCatch,
  onShowOnMap,
  onToggleShared,
}: {
  place: Place;
  onAddCatch: () => void;
  onShowOnMap: () => void;
  /** nur wenn ein Konto möglich ist: Ort mit Freunden teilen ein/aus */
  onToggleShared?: ((on: boolean) => void) | undefined;
}) {
  return (
    <div className={styles.form}>
      <EntryTiles
        water={place.waterSnapshot?.name ?? null}
        position={place.position}
        onShowOnMap={onShowOnMap}
      />
      {place.notes && <NoteCard>{place.notes}</NoteCard>}
      <Button variant="secondary" onClick={onAddCatch}>
        {de.map.addCatchHere}
      </Button>
      {onToggleShared && (
        <RowCard label={de.map.sharedWithFriends}>
          <Switch
            checked={place.sharedWithFriends !== false}
            onChange={onToggleShared}
            label={de.map.sharedWithFriends}
          />
        </RowCard>
      )}
    </div>
  );
}

/** Inhalt des Fang-Blatts; Kopf (`CatchHead`) und untere Leiste (Bearbeiten, Teilen) setzt `MapView` am `Sheet` */
export function CatchDetails({
  item,
  onDelete,
  onShowOnMap,
  onAssignWater,
}: {
  item: Catch;
  onDelete: () => void;
  onShowOnMap: () => void;
  onAssignWater: () => void;
}) {
  return (
    <div className={styles.form}>
      <CatchFacts item={item} onShowOnMap={onShowOnMap} onAssignWater={onAssignWater} />
      <div className={styles.formActions}>
        <Button variant="danger" onClick={onDelete}>
          {de.map.delete}
        </Button>
      </div>
    </div>
  );
}

export function Legend({
  shared = false,
  withCatches = true,
}: {
  shared?: boolean;
  /** false, wenn die Fang-Arten schon bei den Ebenen-Schaltern mit Symbol stehen */
  withCatches?: boolean;
}) {
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
        {shared && (
          <li>
            <Icon kind="shared-spot" />
            {de.spots.legend}
          </li>
        )}
      </ul>
      {withCatches && (
        <>
          <h3 className={styles.legendHead}>{de.map.legendCatches}</h3>
          <ul className={styles.legend}>
            {CATCH_OUTCOMES.map((o) => (
              <li key={o}>
                <Icon kind={`catch-${o}`} />
                {de.map.outcomes[o]}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className={styles.legendHead}>{de.map.legendHeat}</h3>
      <div className={styles.heatScale} aria-hidden="true" />
      <p className="muted">{de.map.legendHeatHint}</p>
    </>
  );
}

/** Ebenen ein-/ausblenden (Kartenfilter); Zahl = vorhandene Einträge mit Position */
export function LayerSwitches({
  filter,
  counts,
  shared,
  onChange,
}: {
  filter: MapFilter;
  counts: Readonly<Record<MapLayerKey, number>>;
  shared: boolean;
  onChange: (f: MapFilter) => void;
}) {
  const t = de.map.layers;
  const rows: { key: MapLayerKey; icon: Parameters<typeof markerDataUrl>[0]; label: string }[] = [
    ...CATCH_OUTCOMES.map((o) => ({
      key: o as MapLayerKey,
      icon: `catch-${o}` as const,
      label: de.map.outcomes[o],
    })),
    { key: 'places', icon: 'place-spot', label: t.places },
    ...(shared ? [{ key: 'shared' as const, icon: 'shared-spot' as const, label: t.shared }] : []),
  ];
  return (
    <fieldset className={styles.layers}>
      <legend className={styles.legendHead}>{t.title}</legend>
      <ul>
        {rows.map((r) => (
          <li key={r.key}>
            <label>
              <input
                type="checkbox"
                checked={filter[r.key]}
                onChange={(e) => onChange({ ...filter, [r.key]: e.target.checked })}
              />
              <Icon kind={r.icon} />
              <span className={styles.layerName}>{r.label}</span>
              <span className="muted">{counts[r.key]}</span>
            </label>
          </li>
        ))}
      </ul>
      {isFiltered(filter) && (
        <Button variant="ghost" onClick={() => onChange(ALL_LAYERS)}>
          {t.showAll}
        </Button>
      )}
      <p className="muted">{t.hint}</p>
    </fieldset>
  );
}
