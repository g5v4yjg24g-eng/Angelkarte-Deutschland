// Fangbuch: alle Einträge nach Tagen, mit Suche und Filtern (M5.3).
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { Button } from '../../design/components/Button';
import { SelectField, TextField } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { BookIcon, ChevronRightIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { CatchOutcomeSchema, type Catch } from '../../domain/schemas';
import { SPECIES, speciesById } from '../../domain/species';
import { filterCatches, groupByDay, NO_FILTER, waterNames, type CatchFilter } from '../../domain/catchDraft';
import { markerDataUrl } from '../map/markerIcons';
import { catchTitle } from './catchText';
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

function CatchRow({ item }: { item: Catch }) {
  const details = [
    item.at.slice(11, 16),
    item.waterSnapshot?.name,
    item.lengthCm !== undefined && de.map.lengthValue(item.lengthCm, item.lengthMethod === 'measured'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <Link to={`/fangbuch/${item.id}`} className={styles.row}>
        <img src={markerDataUrl(`catch-${item.outcome}`)} width={28} height={28} alt="" aria-hidden="true" />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{catchTitle(item)}</span>
          <span className="muted tabular">{details}</span>
        </span>
        <ChevronRightIcon />
      </Link>
    </li>
  );
}

export function CatchesPage() {
  const all = useLiveQuery(() => getDb().catches.toArray(), []);
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
  useEffect(() => {
    if (!undoId && !restored) return;
    const timer = setTimeout(() => {
      setUndoId(undefined);
      setRestored(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, [undoId, restored]);

  const active = useMemo(() => (all ?? []).filter((c) => !c.deletedAt), [all]);
  const list = useMemo(
    () => filterCatches(active, filter, { nowMs, speciesName: (id) => speciesById(id)?.de }),
    [active, filter, nowMs],
  );
  const groups = useMemo(() => groupByDay(list), [list]);
  const waters = useMemo(() => waterNames(active), [active]);
  const usedSpecies = useMemo(() => {
    const ids = new Set(active.map((c) => c.speciesId).filter(Boolean));
    return SPECIES.filter((s) => ids.has(s.id)).sort((a, b) => a.de.localeCompare(b.de, 'de'));
  }, [active]);
  const set = <K extends keyof CatchFilter>(k: K, v: CatchFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const filtered = JSON.stringify(filter) !== JSON.stringify(NO_FILTER);

  const toast = (undoId || restored) && (
    <Toast
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
        <Notice>{t.loading}</Notice>
      </Page>
    );

  if (active.length === 0)
    return (
      <Page title={t.title}>
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
      <div className={styles.filters}>
        <TextField
          label={t.search}
          type="search"
          placeholder={t.searchPlaceholder}
          value={filter.text}
          onChange={(e) => set('text', e.target.value)}
        />
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
          {waters.length > 0 && (
            <SelectField
              label={t.filterWater}
              options={[{ value: '', label: t.allWaters }, ...waters.map((w) => ({ value: w, label: w }))]}
              value={filter.water}
              onChange={(e) => set('water', e.target.value)}
            />
          )}
        </div>
        <p className="muted" aria-live="polite">
          {filtered ? t.filteredCount(list.length, active.length) : t.count(active.length)}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={32} />}
          title={t.noMatchTitle}
          action={
            <Button variant="secondary" onClick={() => setFilter(NO_FILTER)}>
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
            <ul className={styles.rows}>
              {g.items.map((c) => (
                <CatchRow key={c.id} item={c} />
              ))}
            </ul>
          </section>
        ))
      )}
      {toast}
    </Page>
  );
}
