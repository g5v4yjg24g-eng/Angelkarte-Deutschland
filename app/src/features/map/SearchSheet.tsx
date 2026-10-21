// Suche nach Gewässern und Orten im eigenen Index (kein Nominatim-Autocomplete, DATA_SOURCES §2).
import { useEffect, useId, useState } from 'react';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { search, shardKey, type SearchResult } from '../../domain/search';
import type { WaterManifest } from '../../domain/water';
import type { WaterDataProvider } from '../../ports/waterData';
import { useOnline } from '../../lib/useOnline';
import styles from './MapView.module.css';

type State =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; results: SearchResult[] } | { kind: 'error' };

export function SearchSheet({
  water,
  manifest,
  near,
  onPick,
}: {
  water: WaterDataProvider;
  manifest: WaterManifest | null;
  near: { lat: number; lng: number };
  onPick: (r: SearchResult) => void;
}) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const online = useOnline();
  const id = useId();

  useEffect(() => {
    const key = shardKey(q);
    if (!manifest || !key) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setState({ kind: 'loading' });
      water
        .loadSearchShard(manifest, key)
        .then((entries) => !cancelled && setState({ kind: 'done', results: search(entries, q, near) }))
        .catch(() => !cancelled && setState({ kind: 'error' }));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, manifest, water, near]);

  const active = shardKey(q) ? state : { kind: 'idle' as const };
  const typeLabel = (r: SearchResult) =>
    r.isPlace
      ? (de.search.places[r.kind] ?? de.search.placeOther)
      : de.water.types[r.kind as keyof typeof de.water.types];

  return (
    <div className={styles.form}>
      <div className={styles.searchField}>
        <label htmlFor={id}>{de.search.label}</label>
        <input
          id={id}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          placeholder={de.search.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {!manifest && <Notice tone="warning">{online ? de.search.unavailable : de.search.offline}</Notice>}
      {active.kind === 'idle' && manifest && (
        <p className="muted">
          {de.search.hint}{' '}
          {de.search.coverage(
            manifest.coverage.map((c) => de.water.states[c as keyof typeof de.water.states] ?? c).join(', '),
          )}
        </p>
      )}
      {active.kind === 'loading' && <p className="muted">{de.search.loading}</p>}
      {active.kind === 'error' && (
        <Notice tone="warning">{online ? de.search.unavailable : de.search.offline}</Notice>
      )}
      {active.kind === 'done' && active.results.length === 0 && <p className="muted">{de.search.none}</p>}
      {active.kind === 'done' && active.results.length > 0 && (
        <ul className={styles.results} aria-label={de.search.title}>
          {active.results.map((r) => (
            <li key={`${r.name}-${r.kind}-${r.lat}-${r.lng}`}>
              <button type="button" onClick={() => onPick(r)}>
                <span className={styles.resultName}>{r.name}</span>
                <span className="muted">
                  {typeLabel(r)}
                  {r.context ? ` · ${r.context}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
