// Ort suchen (Bereich „Wetter“): Suchfeld mit Trefferliste. Abruf erst ab 2 Zeichen und kurz nach dem letzten Tippen,
// ein neuer Abruf ersetzt den alten. Gesendet wird nur der Suchbegriff (Port `geocoding`).
import { useEffect, useId, useState } from 'react';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { normalizeQuery, type PlaceHit } from '../../domain/placeSearch';
import { useProviders } from '../../ports/providersContext';
import wx from './WeatherView.module.css';

const t = de.forecast.search;
const DEBOUNCE_MS = 350;

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; hits: PlaceHit[] }
  | { status: 'error'; offline: boolean };

export function PlaceSearch({ onPick }: { onPick: (hit: PlaceHit) => void }) {
  const { geocoding } = useProviders();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const id = useId();
  const query = normalizeQuery(text);

  useEffect(() => {
    if (!geocoding || !query) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      geocoding.search(query, ctrl.signal).then(
        (hits) => !ctrl.signal.aborted && setState({ status: 'ok', hits }),
        () => !ctrl.signal.aborted && setState({ status: 'error', offline: navigator.onLine === false }),
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [geocoding, query]);

  // Ohne Suchbegriff gibt es nichts zu zeigen (auch kein alter Treffer)
  const shown: State = query ? state : { status: 'idle' };
  return (
    <div className={wx.search}>
      <label htmlFor={id} className="visually-hidden">
        {t.label}
      </label>
      <input
        id={id}
        type="search"
        className={wx.searchInput}
        value={text}
        placeholder={t.placeholder}
        maxLength={80}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="search"
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      {shown.status === 'loading' && <p className="muted">{t.searching}</p>}
      {shown.status === 'error' && <Notice tone="warning">{shown.offline ? t.offline : t.error}</Notice>}
      {shown.status === 'ok' && shown.hits.length === 0 && <p className="muted">{t.noHits}</p>}
      {shown.status === 'ok' && shown.hits.length > 0 && (
        <ul className={wx.hits} aria-label={t.results}>
          {shown.hits.map((h) => (
            <li key={h.id}>
              <button type="button" className={wx.hit} onClick={() => onPick(h)}>
                <span className={wx.hitName}>{h.name}</span>
                {h.region && <span className={wx.hitRegion}>{h.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
