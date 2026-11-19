// Fangbuch: alle Einträge nach Tagen, mit Suche und Filtern (M5.3); Reiter je Gewässer (P1, 2026-10-22).
import { useCatches } from '../../data/useCatches';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { Button } from '../../design/components/Button';
import { SelectField, TextField } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { BookIcon, SlidersIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { CatchOutcomeSchema, type Catch } from '../../domain/schemas';
import { SPECIES, speciesById } from '../../domain/species';
import { filterCatches, groupByDay, NO_FILTER, type CatchFilter } from '../../domain/catchDraft';
import { groupByWater } from '../../domain/waterGroups';
import { catchbookSummary, type CatchbookSummary } from '../../domain/catchbookSummary';
import { WaterHeader, WaterTabs } from './WaterTabs';
import { CatchbookTabs } from './CatchbookTabs';
import { useWaterPlaces } from './useWaterPlaces';
import { markerDataUrl } from '../map/markerIcons';
import { PhotoThumb } from './CatchPhotos';
import { ListLink } from '../../design/components/ListLink';
import { useRunningSession } from '../sessions/useSessions';
import styles from './CatchesPage.module.css';

const t = de.catches;

/** Navigationszustand nach dem Löschen auf der Detailseite (für „Rückgängig") */
export interface CatchesListState {
  deletedId?: string;
}

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Einstieg zu den Sessions (zeigt eine laufende an) */
function SessionsLink() {
  const running = useRunningSession();
  return (
    <div className={styles.sessionsLink}>
      <ListLink
        to={running ? `/fangbuch/sessions/${running.id}` : '/fangbuch/sessions'}
        icon={<BookIcon />}
        title={running ? de.sessions.running : de.sessions.listLink}
        {...(running ? { hint: de.sessions.since(running.startAt.slice(11, 16)) } : {})}
      />
    </div>
  );
}

/** Großes Foto der Karte; wird erst geladen, wenn die Karte in die Nähe des Bildschirms kommt */
function CardPhoto({ id }: { id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      // ohne Beobachter sofort laden
      queueMicrotask(() => setNear(true));
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: '400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const photo = useLiveQuery(() => (near ? getDb().photos.get(id) : undefined), [id, near]);
  return (
    <span ref={ref} className={styles.cardPhoto} aria-hidden="true">
      <PhotoThumb blob={photo?.blob} alt="" />
    </span>
  );
}

function CatchCard({ item }: { item: Catch }) {
  const species = speciesById(item.speciesId);
  const outcome = de.map.outcomes[item.outcome];
  const water = item.waterSnapshot?.name ?? item.waterSnapshot?.customName;
  const place = item.waterSnapshot?.place;
  const bait = item.bait?.name ?? (item.bait?.type ? de.catchForm.baitTypes[item.bait.type] : undefined);
  const where = [water, place && place !== water ? place : undefined].filter(Boolean).join(' · ');
  const when = [item.at.slice(11, 16), bait].filter(Boolean).join(' · ');
  const length =
    item.lengthCm !== undefined
      ? de.map.lengthValue(item.lengthCm, item.lengthMethod === 'measured')
      : undefined;
  const photoId = item.photoIds?.[0];
  return (
    <li>
      <Link to={`/fangbuch/${item.id}`} className={styles.card}>
        {photoId ? (
          <CardPhoto id={photoId} />
        ) : (
          <span className={styles.cardBanner} aria-hidden="true">
            <img src={markerDataUrl(`catch-${item.outcome}`)} width={32} height={32} alt="" />
          </span>
        )}
        <span className={styles.cardBody}>
          <span className={styles.cardHead}>
            <span className={styles.cardTitle}>
              {species && <span className={styles.cardKicker}>{outcome}</span>}
              <span>{species ? species.de : outcome}</span>
            </span>
            {length && <span className={styles.lengthChip}>{length}</span>}
          </span>
          {where && <span className={styles.cardMeta}>{where}</span>}
          <span className={styles.cardMeta}>{when}</span>
        </span>
      </Link>
    </li>
  );
}

/** Kennzahlen über der Liste: gelandete Fische, größter Fisch, Gewässer */
function Summary({ landed, biggestCm, waters }: CatchbookSummary) {
  const s = t.summary;
  const items = [
    { label: s.landed, value: String(landed) },
    { label: s.biggest, value: biggestCm !== undefined ? de.map.lengthValue(biggestCm, true) : s.none },
    { label: s.waters, value: String(waters) },
  ];
  return (
    <dl className={styles.summary} aria-label={t.summaryLabel}>
      {items.map((i) => (
        <div key={i.label} className={styles.summaryTile}>
          <dd>{i.value}</dd>
          <dt>{i.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function CatchesPage() {
  const all = useCatches();
  const [filter, setFilter] = useState<CatchFilter>(NO_FILTER);
  const location = useLocation();
  const navigate = useNavigate();
  const [undoId, setUndoId] = useState<string | undefined>(
    () => (location.state as CatchesListState | null)?.deletedId,
  );
  const [restored, setRestored] = useState(false);
  // Bezugszeit für „letzte 7 Tage" usw.: einmal beim Öffnen der Seite
  const [nowMs] = useState(() => Date.now());

  // Zustand aus der Navigation nur einmal auswerten (sonst erscheint der Hinweis nach Neuladen erneut)
  useEffect(() => {
    if ((location.state as CatchesListState | null)?.deletedId)
      void navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);

  const active = useMemo(() => (all ?? []).filter((c) => !c.deletedAt), [all]);
  const list = useMemo(
    () => filterCatches(active, filter, { nowMs, speciesName: (id) => speciesById(id)?.de }),
    [active, filter, nowMs],
  );
  useWaterPlaces();
  const waterGroups = useMemo(() => groupByWater(active), [active]);
  // '' = Reiter „Alle" (Standard)
  const [waterKey, setWaterKey] = useState('');
  const selectedWater = waterGroups.find((g) => g.key === waterKey);
  const inWater = useMemo(
    () => (selectedWater ? list.filter((c) => selectedWater.ids.includes(c.id)) : list),
    [list, selectedWater],
  );
  const groups = useMemo(() => groupByDay(inWater), [inWater]);
  const summary = useMemo(() => catchbookSummary(active, waterGroups.length), [active, waterGroups]);
  const usedSpecies = useMemo(() => {
    const ids = new Set(active.map((c) => c.speciesId).filter(Boolean));
    return SPECIES.filter((s) => ids.has(s.id)).sort((a, b) => a.de.localeCompare(b.de, 'de'));
  }, [active]);
  const set = <K extends keyof CatchFilter>(k: K, v: CatchFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const filtered = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Gewählte Filter (ohne Suchtext, der steht immer sichtbar im Feld)
  const activeFilters =
    (filter.outcome ? 1 : 0) +
    (filter.period !== NO_FILTER.period ? 1 : 0) +
    (filter.speciesId ? 1 : 0) +
    (selectedWater ? 1 : 0);

  const toast = (undoId || restored) && (
    <Toast
      onDismiss={() => {
        setUndoId(undefined);
        setRestored(false);
      }}
      actions={
        undoId && (
          <Button
            variant="ghost"
            onClick={() => {
              const id = undoId;
              setUndoId(undefined);
              setRestored(true);
              void repo('catches').restore(id);
            }}
          >
            {de.map.undo}
          </Button>
        )
      }
    >
      {undoId ? t.deleted : de.map.restored}
    </Toast>
  );

  if (!all)
    return (
      <Page title={t.title}>
        <CatchbookTabs />
        <Notice>{t.loading}</Notice>
      </Page>
    );

  if (active.length === 0)
    return (
      <Page title={t.title}>
        <CatchbookTabs />
        <SessionsLink />
        <EmptyState
          icon={<BookIcon size={32} />}
          title={t.emptyTitle}
          action={
            <Link to="/" className={styles.linkButton}>
              {t.emptyAction}
            </Link>
          }
        >
          {t.emptyText}
        </EmptyState>
        {toast}
      </Page>
    );

  return (
    <Page title={t.title}>
      <CatchbookTabs />
      <SessionsLink />
      <Summary {...summary} />
      <div className={styles.searchRow}>
        <span className={styles.searchField}>
          <TextField
            label={t.search}
            hideLabel
            type="search"
            placeholder={t.searchPlaceholder}
            value={filter.text}
            onChange={(e) => set('text', e.target.value)}
          />
        </span>
        <button
          type="button"
          className={styles.filterButton}
          aria-expanded={filtersOpen}
          aria-controls="catch-filters"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersIcon size={20} aria-hidden="true" />
          <span>{t.filters}</span>
          {activeFilters > 0 && <span className={styles.filterCount}>{activeFilters}</span>}
        </button>
      </div>
      <div id="catch-filters" className={styles.filterPanel} hidden={!filtersOpen}>
        <WaterTabs groups={waterGroups} selected={selectedWater ? waterKey : ''} onSelect={setWaterKey} />
        <div className={styles.filterGrid}>
          <SelectField
            label={t.filterOutcome}
            options={[
              { value: '', label: t.all },
              ...CatchOutcomeSchema.options.map((o) => ({ value: o, label: t.outcomesPlural[o] })),
            ]}
            value={filter.outcome}
            onChange={(e) => set('outcome', e.target.value as CatchFilter['outcome'])}
          />
          <SelectField
            label={t.filterPeriod}
            options={(Object.keys(t.periods) as CatchFilter['period'][]).map((p) => ({
              value: p,
              label: t.periods[p],
            }))}
            value={filter.period}
            onChange={(e) => set('period', e.target.value as CatchFilter['period'])}
          />
          {usedSpecies.length > 0 && (
            <SelectField
              label={t.filterSpecies}
              options={[
                { value: '', label: t.allSpecies },
                ...usedSpecies.map((s) => ({ value: s.id, label: s.de })),
              ]}
              value={filter.speciesId}
              onChange={(e) => set('speciesId', e.target.value)}
            />
          )}
        </div>
      </div>
      {selectedWater && <WaterHeader key={selectedWater.key} group={selectedWater} />}
      <p className="muted" aria-live="polite">
        {filtered || selectedWater ? t.filteredCount(inWater.length, active.length) : t.count(active.length)}
      </p>

      {groups.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={32} />}
          title={t.noMatchTitle}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setFilter(NO_FILTER);
                setWaterKey('');
              }}
            >
              {t.resetFilters}
            </Button>
          }
        >
          {t.noMatchText}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.day} className={styles.day} aria-labelledby={`tag-${g.day}`}>
            <h2 id={`tag-${g.day}`} className={styles.dayTitle}>
              {dayLabel(g.day)}
            </h2>
            <ul className={styles.cards}>
              {g.items.map((c) => (
                <CatchCard key={c.id} item={c} />
              ))}
            </ul>
          </section>
        ))
      )}
      {toast}
    </Page>
  );
}
