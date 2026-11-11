// Suche nach Gewässern und Orten direkt in der Suchleiste auf der Karte (Wunsch Nutzer 2026-11-11: kein Zwischenfenster,
// Tipp auf die Leiste öffnet die Tastatur, Treffer erscheinen darunter). Eigener Index, kein Nominatim (DATA_SOURCES §2).
import { useEffect, useId, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { search, shardKey, type SearchResult } from '../../domain/search';
import type { WaterManifest } from '../../domain/water';
import type { WaterDataProvider } from '../../ports/waterData';
import { useOnline } from '../../lib/useOnline';
import styles from './MapView.module.css';

type State =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; results: SearchResult[] } | { kind: 'error' };

export function SearchBox({
  water,
  manifest,
  getNear,
  onPick,
  onActiveChange,
  onOpenDetail,
}: {
  water: WaterDataProvider;
  manifest: WaterManifest | null;
  /** Kartenmitte zum Sortieren nach Nähe – bei jeder Anfrage frisch gelesen, löst keine neue Suche aus */
  getNear: () => { lat: number; lng: number };
  onPick: (r: SearchResult) => void;
  /** Tastatur/Trefferliste offen: die Karte hält dann ihre Größe */
  onActiveChange?: (active: boolean) => void;
  /** Filter-Symbol in der Leiste: öffnet die Detailsuche */
  onOpenDetail?: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const online = useOnline();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = shardKey(q);
    if (!manifest || !key) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setState({ kind: 'loading' });
      water
        .loadSearchShard(manifest, key)
        .then((entries) => !cancelled && setState({ kind: 'done', results: search(entries, q, getNear()) }))
        .catch(() => !cancelled && setState({ kind: 'error' }));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, manifest, water, getNear]);

  // Tipp außerhalb (z. B. auf die Karte) schließt die Liste; auf dem iPhone feuert pointerdown vor dem Fokuswechsel
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        input.current?.blur();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  useEffect(() => {
    onActiveChange?.(open);
  }, [open, onActiveChange]);

  const active = shardKey(q) ? state : { kind: 'idle' as const };
  const typeLabel = (r: SearchResult) =>
    r.isPlace
      ? (de.search.places[r.kind] ?? de.search.placeOther)
      : de.water.types[r.kind as keyof typeof de.water.types];
  const unavailable = !manifest || active.kind === 'error';
  const showList = open && (q.trim() !== '' || !manifest);

  const close = () => {
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div ref={root} className={styles.searchWrap}>
      <div className={styles.searchPill}>
        <SearchIcon />
        <input
          ref={input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={de.search.open}
          aria-controls={showList ? listId : undefined}
          placeholder={de.search.open}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
        />
        {q && (
          <button
            type="button"
            className={styles.searchClear}
            aria-label={de.search.clear}
            onClick={() => {
              setQ('');
              setState({ kind: 'idle' });
              input.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
        {onOpenDetail && (
          <button
            type="button"
            className={styles.searchFilter}
            aria-label={de.detailSearch.open}
            onClick={() => {
              setOpen(false);
              input.current?.blur();
              onOpenDetail();
            }}
          >
            <FilterIcon />
          </button>
        )}
      </div>
      {showList && (
        <div id={listId} className={styles.searchResults}>
          {unavailable && (
            <Notice tone="warning">{online ? de.search.unavailable : de.search.offline}</Notice>
          )}
          {!unavailable && active.kind === 'loading' && <p className="muted">{de.search.loading}</p>}
          {!unavailable && active.kind === 'done' && active.results.length === 0 && (
            <p className="muted">{de.search.none}</p>
          )}
          {!unavailable && active.kind === 'done' && active.results.length > 0 && (
            <ul className={styles.results} aria-label={de.search.results}>
              {active.results.map((r) => (
                <li key={`${r.name}-${r.kind}-${r.lat}-${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setQ('');
                      setState({ kind: 'idle' });
                      close();
                      onPick(r);
                    }}
                  >
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
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </svg>
  );
}
