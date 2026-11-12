// Detailsuche (Wunsch Nutzer 2026-11-11): Vollbild-Fenster mit Name, Umkreis um den eigenen Standort und Gewässerart
// (Mehrfachauswahl). Ohne gewählte Art zeigt die Liste alle Gewässer im Umkreis; sobald eine Art angehakt ist, nur
// diese. Rechnet auf dem Gerät mit dem Suchindex, keine Position wird gesendet.
import { useEffect, useId, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Switch } from '../../design/components/Switch';
import { ChevronLeftIcon } from '../../design/icons';
import {
  formatDistance,
  kindSummary,
  NEARBY_KINDS,
  nearbyWaters,
  toggleKind,
  type NearbyResult,
  type NearbySort,
} from '../../domain/nearby';
import type { SearchEntry, SearchResult } from '../../domain/search';
import type { WaterManifest } from '../../domain/water';
import type { WaterDataProvider } from '../../ports/waterData';
import { useOnline } from '../../lib/useOnline';
import { WaterThumb } from './WaterThumb';
import { thumbUrl, type WaterPhoto } from '../../domain/waterPhotos';
import styles from './DetailSearch.module.css';

const t = de.detailSearch;
const PAGE = 50;
const kindLabel = (k: string) =>
  k === 'other' ? t.kindOther : (de.water.types[k as keyof typeof de.water.types] ?? k);

export function DetailSearch({
  water,
  manifest,
  photos,
  me,
  getCenter,
  onPick,
  onClose,
}: {
  water: WaterDataProvider;
  manifest: WaterManifest | null;
  /** Fotos je Gewässer-ID (Wikimedia Commons); fehlt eines, zeigt die Karte den Platzhalter */
  photos: Readonly<Record<string, WaterPhoto>>;
  /** eigener Standort, falls bekannt */
  me?: { lat: number; lng: number } | undefined;
  /** Kartenmitte als Ersatz (bei der Suche gelesen) */
  getCenter: () => { lat: number; lng: number };
  onPick: (r: SearchResult) => void;
  onClose: () => void;
}) {
  const online = useOnline();
  const nameId = useId();
  const [name, setName] = useState('');
  const [near, setNear] = useState(true);
  const [radius, setRadius] = useState(10);
  const [kinds, setKinds] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [sort, setSort] = useState<NearbySort>('distance');
  const [data, setData] = useState<
    { kind: 'loading'; done: number } | { kind: 'ready'; entries: SearchEntry[] } | { kind: 'error' }
  >({
    kind: 'loading',
    done: 0,
  });
  const [tick, setTick] = useState(0);
  const [results, setResults] = useState<NearbyResult[] | undefined>();
  const [shown, setShown] = useState(PAGE);
  const menuRef = useRef<HTMLDivElement>(null);

  // Index einmal laden (danach auf dem Gerät gemerkt)
  useEffect(() => {
    if (!manifest) return;
    let live = true;
    water
      .loadAllSearchEntries(manifest, (done) => live && setData({ kind: 'loading', done }))
      .then((entries) => live && setData({ kind: 'ready', entries }))
      .catch(() => live && setData({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [water, manifest, tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, onClose]);

  // Tipp außerhalb des Dropdowns schließt es
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [menu]);

  const canSearch = data.kind === 'ready' && (near || name.trim() !== '' || kinds.length > 0);

  const run = (nextSort = sort) => {
    if (data.kind !== 'ready') return;
    setResults(
      nearbyWaters(data.entries, {
        origin: near || nextSort === 'distance' ? (me ?? getCenter()) : undefined,
        radiusKm: near ? radius : undefined,
        kinds,
        name,
        sort: !near && nextSort === 'distance' ? 'name' : nextSort,
      }),
    );
    setShown(PAGE);
  };

  const pct = data.kind === 'loading' ? Math.round(data.done * 100) : 100;
  const unavailable = !manifest || data.kind === 'error';

  return (
    <div
      className={styles.screen}
      data-testid="detail-search"
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
    >
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onClose} aria-label={t.close}>
          <ChevronLeftIcon />
        </button>
        <h1>{t.title}</h1>
      </header>
      <div className={styles.body}>
        <label className={styles.field} htmlFor={nameId}>
          <SearchIcon />
          <input
            id={nameId}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={t.namePlaceholder}
            aria-label={t.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSearch && run()}
          />
        </label>

        <div className={styles.row}>
          <PinIcon />
          <span className={styles.grow}>{t.nearby}</span>
          <Switch checked={near} onChange={setNear} label={t.nearby} />
        </div>

        {near && (
          <div className={styles.radius}>
            <div className={styles.radiusHead}>
              <label htmlFor={`${nameId}-r`}>{t.radius}</label>
              <strong>{t.radiusValue(radius)}</strong>
            </div>
            <input
              id={`${nameId}-r`}
              type="range"
              min={1}
              max={50}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-valuetext={t.radiusValue(radius)}
            />
            {!me && <span className="muted">{t.fromCenter}</span>}
          </div>
        )}

        <div className={styles.kinds} ref={menuRef}>
          <button
            type="button"
            className={styles.kindButton}
            aria-haspopup="true"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <WaveIcon />
            <span className={styles.grow}>
              <small>{t.kind}</small>
              <b>{kindSummary(kinds, kindLabel, t.allKinds)}</b>
            </span>
            <ChevronIcon open={menu} />
          </button>
          {menu && (
            <div className={styles.menu} role="group" aria-label={t.kind}>
              {NEARBY_KINDS.map((k) => (
                <label key={k} className={styles.menuItem}>
                  <input
                    type="checkbox"
                    checked={kinds.includes(k)}
                    onChange={() => setKinds((s) => toggleKind(s, k))}
                  />
                  <span className={styles.box} aria-hidden="true" />
                  {kindLabel(k)}
                </label>
              ))}
              <div className={styles.menuFoot}>
                <button type="button" onClick={() => setKinds([])} disabled={kinds.length === 0}>
                  {t.reset}
                </button>
                <button type="button" onClick={() => setMenu(false)}>
                  {t.done}
                </button>
              </div>
            </div>
          )}
        </div>

        <Button onClick={() => run()} disabled={!canSearch} block>
          {data.kind === 'loading' && !unavailable ? t.loadingData(pct) : t.go}
        </Button>

        {unavailable && (
          <Notice tone="warning">
            {online ? t.unavailable : de.search.offline}{' '}
            {manifest && (
              <Button variant="secondary" onClick={() => setTick((n) => n + 1)}>
                {t.retry}
              </Button>
            )}
          </Notice>
        )}

        {results && (
          <section aria-label={t.resultsLabel}>
            <div className={styles.resultsHead}>
              <span>{results.length === 1 ? t.foundOne : t.found(results.length)}</span>
              <label className={styles.sort}>
                <span className={styles.srOnly}>{t.sort.label}</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    const next = e.target.value as NearbySort;
                    setSort(next);
                    run(next);
                  }}
                >
                  <option value="distance">{t.sort.distance}</option>
                  <option value="name">{t.sort.name}</option>
                  <option value="size">{t.sort.size}</option>
                </select>
              </label>
            </div>
            {results.length === 0 ? (
              <p className="muted">{t.none}</p>
            ) : (
              <ul className={styles.list}>
                {results.slice(0, shown).map((r) => (
                  <li key={`${r.wid ?? r.name}-${r.lat}-${r.lng}`}>
                    <button type="button" className={styles.card} onClick={() => onPick(r)}>
                      <span className={styles.thumb}>
                        <WaterThumb
                          kind={r.kind}
                          photo={
                            r.wid && photos[r.wid] ? thumbUrl(photos[r.wid] as WaterPhoto, 250) : undefined
                          }
                        />
                      </span>
                      <span className={styles.text}>
                        <b>{r.name}</b>
                        <span>
                          {kindLabel(r.kind)}
                          {r.context ? ` · ${r.context}` : ''}
                        </span>
                      </span>
                      {r.distanceKm !== undefined && (
                        <span className={styles.dist}>{formatDistance(r.distanceKm)}</span>
                      )}
                      <span className={styles.chev} aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {results.length > shown && (
              <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)} block>
                {t.more}
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width={18}
      height={18}
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
function PinIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function WaveIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 14c3-3 6 3 9 0s6 3 9 0" />
    </svg>
  );
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : undefined }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
