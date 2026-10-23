// Animierte Route im Session-Rückblick, auf der echten Karte der App (MapLibre, gleiche Basiskarte und Symbole).
// Die Route wächst in zeitlicher Reihenfolge; Einträge erscheinen, sobald die Wiedergabe ihren Zeitpunkt erreicht.
// Lücken in der Aufzeichnung bleiben Lücken. Wird lazy geladen (MapLibre nur bei Bedarf).
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AttributionControl,
  LngLatBounds,
  Map as MlMap,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { FeatureCollection } from 'geojson';
import { de } from '../../../i18n/de';
import { useProviders } from '../../../ports/providersContext';
import { Button } from '../../../design/components/Button';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import { Notice } from '../../../design/components/Notice';
import { useEffectiveTheme } from '../../../lib/useEffectiveTheme';
import type { CatchOutcome, LatLng, TrackPoint } from '../../../domain/schemas';
import { routeUntil, spreadOffsets } from '../../../domain/track';
import { addMarkerImages, fallbackStyle } from '../../map/mapLayers';
import { germanTextFields } from '../../map/germanLabels';
import styles from './Review.module.css';

setWorkerUrl(workerUrl);

const t = de.review;
/** Dauer der ganzen Wiedergabe bei 1× */
export const BASE_PLAY_MS = 20_000;
const SPEEDS = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
] as const;
const FLASH_MS = 1600;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface ReviewMapApi {
  focus: (id: string) => void;
}

export interface MapEvent {
  id: string;
  outcome: CatchOutcome;
  at: number;
  position?: LatLng | undefined;
}

const COLORS = {
  light: {
    route: '#0F5C6E',
    casing: '#ffffff',
    start: '#2E7D4F',
    end: '#1B2A2F',
    head: '#0F5C6E',
    ring: '#E39B2D',
  },
  dark: {
    route: '#7FD1C7',
    casing: '#0b1f22',
    start: '#6FCF97',
    end: '#EAF3F2',
    head: '#7FD1C7',
    ring: '#F2B65A',
  },
};

declare global {
  interface Window {
    __fangpunktReviewMap?: MlMap;
  }
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Ring um einen hervorgehobenen Marker (als Symbol, damit er denselben Versatz wie der Marker bekommt). */
function ringImage(color: string): ImageData | undefined {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.lineWidth = 8;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(48, 48, 40, 0, Math.PI * 2);
  ctx.stroke();
  return ctx.getImageData(0, 0, 96, 96);
}

export default function ReviewMap({
  segments,
  events,
  from,
  to,
  selectedId,
  controller,
  onSelect,
}: {
  segments: TrackPoint[][];
  events: MapEvent[];
  from: number;
  to: number;
  selectedId?: string | undefined;
  /** Wird mit Funktionen für die Chronik gefüllt (zu einem Eintrag springen) */
  controller?: Ref<ReviewMapApi> | undefined;
  onSelect: (id: string) => void;
}) {
  const { basemap } = useProviders();
  const theme = useEffectiveTheme();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const ready = useRef(false);
  // Bei „Bewegung reduzieren“: gleich die ganze Route, keine Wiedergabe
  const [initial] = useState(() => (reducedMotion() ? 1 : 0));
  const progress = useRef(initial);
  const [playing, setPlaying] = useState(initial === 0);
  const playingRef = useRef(playing);
  const [speed, setSpeed] = useState<'1' | '2' | '4'>('1');
  const [shown, setShown] = useState(initial);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const flash = useRef<{ id: string; until: number } | undefined>(undefined);
  const userMoved = useRef(false);
  const lastFollow = useRef(0);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const span = Math.max(1, to - from);

  // Versatz für Marker an derselben Stelle (einmal je Datensatz)
  const placed = useRef<(MapEvent & { off: [number, number] })[]>([]);
  useEffect(() => {
    const withPos = events.filter((e) => e.position);
    const offs = spreadOffsets(withPos.map((e) => e.position as LatLng));
    placed.current = withPos.map((e, i) => ({ ...e, off: offs[i] ?? [0, 0] }));
  }, [events]);
  useEffect(() => {
    selectedRef.current = selectedId;
    onSelectRef.current = onSelect;
    playingRef.current = playing;
  });

  const lastVisible = useRef('');
  /** Zeichnet den Stand zum Fortschritt p (0–1) */
  function render(p: number) {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const tNow = from + p * span;
    const { lines, head } = routeUntil(segments, tNow);
    // Für Tests und Hilfsmittel: wie viele Abschnitte/Punkte gerade gezeichnet sind (ohne React-Neuzeichnen)
    if (box.current) {
      box.current.dataset.routeLines = String(lines.length);
      box.current.dataset.routePoints = String(lines.reduce((n, l) => n + l.length, 0));
    }
    (map.getSource('rv-route') as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    });
    const pts: GeoJSON.Feature[] = [];
    const first = segments[0]?.[0];
    if (first && first.t <= tNow)
      pts.push({
        type: 'Feature',
        properties: { kind: 'start' },
        geometry: { type: 'Point', coordinates: [first.lng, first.lat] },
      });
    const last = segments.at(-1)?.at(-1);
    if (last && p >= 1)
      pts.push({
        type: 'Feature',
        properties: { kind: 'end' },
        geometry: { type: 'Point', coordinates: [last.lng, last.lat] },
      });
    if (head && p < 1)
      pts.push({
        type: 'Feature',
        properties: { kind: 'head' },
        geometry: { type: 'Point', coordinates: [head.lng, head.lat] },
      });
    (map.getSource('rv-points') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: pts,
    });

    const visible = placed.current.filter((e) => e.at <= tNow || p >= 1);
    const key = visible.map((e) => e.id).join(',');
    if (key !== lastVisible.current) {
      // Neu erschienener Fang wird kurz hervorgehoben
      const before = new Set(lastVisible.current.split(','));
      const fresh = visible.find((e) => !before.has(e.id) && e.outcome === 'caught');
      if (fresh && playingRef.current) flash.current = { id: fresh.id, until: performance.now() + FLASH_MS };
      lastVisible.current = key;
      setVisibleIds(visible.map((e) => e.id));
      (map.getSource('rv-events') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: visible.map((e) => ({
          type: 'Feature',
          properties: { id: e.id, outcome: e.outcome, off: e.off, t: e.at },
          geometry: { type: 'Point', coordinates: [(e.position as LatLng).lng, (e.position as LatLng).lat] },
        })),
      });
    }
    const ring = [
      selectedRef.current,
      flash.current && flash.current.until > performance.now() ? flash.current.id : '',
    ]
      .filter(Boolean)
      .join(',');
    map.setFilter('rv-ring', ['in', ['get', 'id'], ['literal', ring.split(',')]]);

    // Kamera folgt nur, wenn der Kopf den sichtbaren Bereich verlässt und niemand selbst verschoben hat
    if (head && playingRef.current && !userMoved.current && performance.now() - lastFollow.current > 1200) {
      const pt = map.project([head.lng, head.lat]);
      const c = map.getContainer();
      const mx = c.clientWidth * 0.15;
      const my = c.clientHeight * 0.15;
      if (pt.x < mx || pt.y < my || pt.x > c.clientWidth - mx || pt.y > c.clientHeight - my) {
        lastFollow.current = performance.now();
        map.easeTo({ center: [head.lng, head.lat], duration: 900 });
      }
    }
  }
  const renderRef = useRef(render);
  useEffect(() => {
    renderRef.current = render;
  });

  function fitAll(animate: boolean) {
    const map = mapRef.current;
    if (!map) return;
    const b = new LngLatBounds();
    for (const s of segments) for (const p of s) b.extend([p.lng, p.lat]);
    for (const e of events) if (e.position) b.extend([e.position.lng, e.position.lat]);
    if (b.isEmpty()) return;
    map.fitBounds(b, { padding: 48, maxZoom: 17, duration: animate && !reducedMotion() ? 600 : 0 });
  }

  // Karte einmal anlegen
  useEffect(() => {
    if (!box.current) return;
    const colors = COLORS[theme];
    const map = new MlMap({
      container: box.current,
      style: navigator.onLine ? basemap.styleUrl(theme) : fallbackStyle(theme),
      center: [10.4, 51.2],
      zoom: 5,
      attributionControl: false,
      maxPitch: 0,
      dragRotate: false,
      cooperativeGestures: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
    window.__fangpunktReviewMap = map;
    let styleLoaded = false;
    map.on('error', (e) => {
      const fromSource = 'sourceId' in e && !!(e as { sourceId?: string }).sourceId;
      if (!styleLoaded && !fromSource) {
        setOffline(true);
        map.setStyle(fallbackStyle(theme));
      }
    });
    map.on('style.load', () => {
      styleLoaded = true;
      for (const { id, textField } of germanTextFields(
        map.getStyle().layers as Parameters<typeof germanTextFields>[0],
      ))
        map.setLayoutProperty(id, 'text-field', textField);
      for (const id of basemap.adjustments(theme).hideLayers ?? [])
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      void addMarkerImages(map).then(() => {
        const ring = ringImage(colors.ring);
        if (ring && !map.hasImage('rv-ring')) map.addImage('rv-ring', ring, { pixelRatio: 2 });
        map.addSource('rv-route', { type: 'geojson', data: EMPTY });
        map.addSource('rv-points', { type: 'geojson', data: EMPTY });
        map.addSource('rv-events', { type: 'geojson', data: EMPTY });
        map.addLayer({
          id: 'rv-route-casing',
          type: 'line',
          source: 'rv-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': colors.casing, 'line-width': 8, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'rv-route',
          type: 'line',
          source: 'rv-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': colors.route, 'line-width': 4.5 },
        });
        map.addLayer({
          id: 'rv-points',
          type: 'circle',
          source: 'rv-points',
          paint: {
            'circle-radius': ['match', ['get', 'kind'], 'head', 7, 8],
            'circle-color': ['match', ['get', 'kind'], 'start', colors.start, 'end', colors.end, colors.head],
            'circle-stroke-color': colors.casing,
            'circle-stroke-width': 3,
          },
        });
        map.addLayer({
          id: 'rv-ring',
          type: 'symbol',
          source: 'rv-events',
          filter: ['in', ['get', 'id'], ['literal', []]],
          layout: {
            'icon-image': 'rv-ring',
            'icon-offset': ['get', 'off'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
        map.addLayer({
          id: 'rv-events',
          type: 'symbol',
          source: 'rv-events',
          layout: {
            'icon-image': ['concat', 'catch-', ['get', 'outcome']],
            'icon-offset': ['get', 'off'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['get', 't'],
          },
        });
        ready.current = true;
        lastVisible.current = '';
        fitAll(false);
        renderRef.current(progress.current);
      });
    });
    map.on('click', 'rv-events', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) onSelectRef.current(id);
    });
    map.on('mouseenter', 'rv-events', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'rv-events', () => (map.getCanvas().style.cursor = ''));
    // Eigenes Verschieben/Zoomen beendet das Mitführen der Kamera
    const stopFollow = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userMoved.current = true;
    };
    map.on('dragstart', stopFollow);
    map.on('zoomstart', stopFollow);
    return () => {
      ready.current = false;
      mapRef.current = null;
      if (window.__fangpunktReviewMap === map) delete window.__fangpunktReviewMap;
      map.remove();
    };
    // Bewusst nur einmal: Daten und Fortschritt laufen über Refs, ein Themenwechsel im Rückblick ist selten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wiedergabe: genau eine Animationsschleife, solange `playing`
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      progress.current = Math.min(1, progress.current + (dt * Number(speed)) / BASE_PLAY_MS);
      renderRef.current(progress.current);
      if (now - lastUi > 100 || progress.current >= 1) {
        lastUi = now;
        setShown(progress.current);
      }
      if (progress.current >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  // Auswahl (Marker oder Chronik) neu zeichnen
  useEffect(() => {
    renderRef.current(progress.current);
  }, [selectedId]);

  // Sprung aus der Chronik: Wiedergabe mindestens bis zum Eintrag, Karte dorthin (Aufruf aus einem Klick)
  useImperativeHandle(
    controller,
    () => ({
      focus(id: string) {
        const e = events.find((x) => x.id === id);
        if (!e?.position) return;
        setPlaying(false);
        progress.current = Math.max(progress.current, Math.min(1, (e.at - from) / span));
        setShown(progress.current);
        renderRef.current(progress.current);
        userMoved.current = true;
        mapRef.current?.easeTo({
          center: [e.position.lng, e.position.lat],
          zoom: Math.max(mapRef.current.getZoom(), 16),
          duration: reducedMotion() ? 0 : 700,
        });
      },
    }),
    [events, from, span],
  );

  function seek(p: number) {
    setPlaying(false);
    progress.current = p;
    setShown(p);
    renderRef.current(p);
  }

  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.mapBlock}>
      {offline && <Notice tone="warning">{t.offline}</Notice>}
      <div
        ref={box}
        className={styles.map}
        role="region"
        aria-label={t.mapLabel}
        data-progress={shown.toFixed(3)}
        data-visible-events={visibleIds.join(',')}
      />
      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <Button
            onClick={() => {
              if (!playing && progress.current >= 1) progress.current = 0;
              userMoved.current = false;
              setPlaying((x) => !x);
            }}
          >
            {playing ? t.pause : t.play}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              progress.current = 0;
              lastVisible.current = '';
              userMoved.current = false;
              setShown(0);
              fitAll(true);
              renderRef.current(0);
              setPlaying(true);
            }}
          >
            {t.replay}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              seek(1);
              fitAll(true);
            }}
          >
            {t.showAll}
          </Button>
        </div>
        <div className={styles.controlRow}>
          <SegmentedControl label={t.speed} options={SPEEDS} value={speed} onChange={setSpeed} />
          <label className={styles.scrub}>
            <span className="visually-hidden">{t.timeline}</span>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(shown * 1000)}
              aria-valuetext={clock(from + shown * span)}
              onChange={(e) => seek(Number(e.target.value) / 1000)}
            />
            <span className="tabular muted">{clock(from + shown * span)}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
