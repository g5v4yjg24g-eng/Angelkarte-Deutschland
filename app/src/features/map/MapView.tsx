// Deutschlandkarte: Basiskarte (BasemapProvider), Gewässer (WaterDataProvider, M4), eigene Orte und Fänge,
// Tipp-Aktion, Suche, Standort.
import 'maplibre-gl/dist/maplibre-gl.css';
import { addProtocol, AttributionControl, Map as MlMap, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { useProviders } from '../../ports/providersContext';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import type { PlaceType } from '../../domain/schemas';
import { waterFromTile, waterPlace, type WaterInfo, type WaterManifest } from '../../domain/water';
import type { SearchResult } from '../../domain/search';
import { IconButton, Button } from '../../design/components/Button';
import { Sheet } from '../../design/components/Sheet';
import { Toast } from '../../design/components/Toast';
import { Notice } from '../../design/components/Notice';
import { HeatIcon, InfoIcon } from '../../design/icons';
import { useEffectiveTheme } from '../../lib/useEffectiveTheme';
import { useOnline } from '../../lib/useOnline';
import { circlePolygon, toFeatures } from './geojson';
import {
  addOverlays,
  addWaterLayers,
  EMPTY,
  fallbackStyle,
  INTERACTIVE_LAYERS,
  LAYERS,
  setHeatmap,
  setOverlayData,
  type OverlayData,
  WATER,
} from './mapLayers';
import { WaterProfile } from './WaterProfile';
import { SearchSheet } from './SearchSheet';
import { CatchDetails, Legend, NewHere, PlaceDetails, PlaceForm } from './MapSheets';
import { CatchForm, type CatchContext, type WaterChoice } from '../catches/CatchForm';
import { useRunningSession } from '../sessions/useSessions';
import { tryStartSession } from '../sessions/sessionActions';
import { geolocationDenied, useGeolocation } from './useGeolocation';
import { useBoolSetting } from '../settings/useBoolSetting';
import { germanTextFields } from './germanLabels';
import styles from './MapView.module.css';

setWorkerUrl(workerUrl);
// Gewässerdaten liegen als PMTiles-Datei vor (HTTP-Range-Abrufe statt Kachelserver)
addProtocol('pmtiles', new Protocol().tile);

type WaterRef = { wid: string; name?: string };
type SheetState =
  | { kind: 'new'; lat: number; lng: number; water?: WaterRef }
  | { kind: 'placeForm'; type: PlaceType; lat: number; lng: number; id?: string; water?: WaterRef }
  | { kind: 'water'; info: WaterInfo; lat: number; lng: number }
  | { kind: 'search'; near: { lat: number; lng: number } }
  | { kind: 'place'; id: string }
  | { kind: 'catch'; id: string }
  | { kind: 'catchForm'; context?: CatchContext; id?: string }
  | { kind: 'assignWater'; id: string; candidates?: WaterInfo[] }
  | { kind: 'legend' }
  | { kind: 'locate' };

const VIEW_KEY = 'fangpunkt.mapView';
const GERMANY = { center: [10.4, 51.2] as [number, number], zoom: 5.2 };
const LOC_HINT_KEY = 'fangpunkt.locHintSeen';
const HEAT_KEY = 'fangpunkt.heatmap';
const HEAT_MIN = 30;
/** OSMF: Vermerk darf nach Interaktion oder 5 s einklappen, muss aber auffindbar bleiben */
const ATTRIBUTION_COLLAPSE_MS = 5000;

/**
 * Einmal pro App-Start auf den Standort zoomen. Beim Zurückwechseln zur Karte bleibt die zuletzt gesehene Ansicht
 * (Wunsch Nutzer 2026-10-23); zurück zum Standort geht es mit dem Knopf „Zu meinem Standort“.
 */
let centeredThisLaunch = false;

function readHeat(): boolean {
  try {
    return localStorage.getItem(HEAT_KEY) === '1';
  } catch {
    return false;
  }
}

function readView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (v && Number.isFinite(v.lng) && Number.isFinite(v.lat) && Number.isFinite(v.zoom))
      return { center: [v.lng, v.lat] as [number, number], zoom: v.zoom as number };
  } catch {
    // Nur Komfort: ohne gespeicherte Ansicht startet die Karte bei Deutschland.
  }
  return GERMANY;
}

function locHintSeen(): boolean {
  try {
    return localStorage.getItem(LOC_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Navigationszustand: aus dem Fangbuch „Auf der Karte zeigen" */
export interface MapFocusState {
  focusCatch?: string;
  /** Aus dem Fangbuch: Gewässer für diesen Eintrag zuordnen (M5.5) */
  assignWater?: string;
}

/** Gewässer an einem Bildschirmpunkt: Fläche unter dem Finger, sonst Fließgewässer im Umkreis. */
function waterAt(map: MlMap, point: { x: number; y: number }): WaterInfo | undefined {
  const box: [[number, number], [number, number]] = [
    [point.x - 10, point.y - 10],
    [point.x + 10, point.y + 10],
  ];
  const area = map.getLayer(WATER.fill)
    ? map.queryRenderedFeatures([point.x, point.y], { layers: [WATER.fill] })[0]
    : undefined;
  if (area) return waterFromTile(area.properties, false);
  const line = map.getLayer(WATER.lineHit)
    ? map.queryRenderedFeatures(box, { layers: [WATER.lineHit] })[0]
    : undefined;
  return line ? waterFromTile(line.properties, true) : undefined;
}

/**
 * Gewässer in der Nähe eines Punktes (Zuordnung, M5.5): die Fläche unter dem Punkt zuerst, dann weitere Flächen
 * und Fließgewässer im Umkreis; jedes nur einmal, höchstens fünf.
 */
function waterCandidates(map: MlMap, point: { x: number; y: number }, radius = 40): WaterInfo[] {
  const out: WaterInfo[] = [];
  const add = (props: Record<string, unknown>, isLine: boolean) => {
    const w = waterFromTile(props, isLine);
    if (w && !out.some((o) => o.wid === w.wid)) out.push(w);
  };
  if (map.getLayer(WATER.fill))
    for (const f of map.queryRenderedFeatures([point.x, point.y], { layers: [WATER.fill] }))
      add(f.properties, false);
  const layers = [WATER.fill, WATER.lineHit].filter((l) => map.getLayer(l));
  if (layers.length)
    for (const f of map.queryRenderedFeatures(
      [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ],
      { layers },
    ))
      add(f.properties, f.layer.id === WATER.lineHit);
  return out.slice(0, 5);
}

const toChoice = (w: WaterInfo): WaterChoice => ({
  wid: w.wid,
  type: w.type,
  ...(w.name ? { name: w.name } : {}),
  ...(waterPlace(w) ? { place: waterPlace(w) } : {}),
});

/** Kontext für ein neues Formular: genau ein Gewässer → zugeordnet; mehrere → Auswahl, vorbelegt mit dem unter dem Punkt. */
function waterContext(
  map: MlMap,
  point: { x: number; y: number },
): Pick<CatchContext, 'water' | 'waterOptions'> {
  const found = waterCandidates(map, point);
  const under = map.getLayer(WATER.fill)
    ? map.queryRenderedFeatures([point.x, point.y], { layers: [WATER.fill] }).length > 0
    : false;
  const first = found[0];
  if (!first) return {};
  if (found.length === 1) return { water: toChoice(first) };
  return { ...(under ? { water: toChoice(first) } : {}), waterOptions: found.map(toChoice) };
}

declare global {
  interface Window {
    /** Testzugriff (E2E): Karte und Bildschirmkoordinaten eigener Objekte. */
    __fangpunktMap?: MlMap;
  }
}

export default function MapView() {
  const { basemap, water } = useProviders();
  const theme = useEffectiveTheme();
  const online = useOnline();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [baseFailed, setBaseFailed] = useState(false);
  const [usingFallback, setUsingFallback] = useState(!navigator.onLine);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => Promise<void> }>();
  const [locating, setLocating] = useState(false);
  // Standort beim Kartenstart (Einstellung, Standard an). Verweigert der Browser, bleibt es still aus.
  const locateOnStart = useBoolSetting('locateOnStart', true);
  const autoLocated = useRef(false);
  const autoChecked = useRef(false);
  const geo = useGeolocation(locating, (e) => {
    if (!autoLocated.current || e !== 'denied') return;
    autoLocated.current = false;
    setLocating(false);
  });
  const centeredOnFix = useRef(centeredThisLaunch);
  const [waterManifest, setWaterManifest] = useState<WaterManifest | null>(null);
  const waterRef = useRef<WaterManifest | null>(null);
  const [selectedWid, setSelectedWid] = useState<string>();
  const location = useLocation();
  const navigate = useNavigate();
  const runningSession = useRunningSession();
  // „Fang erfassen": wartet auf den Tipp an die Fangstelle (der nächste Tipp öffnet das Formular dort)
  const [picking, setPicking] = useState(false);
  const [centerFocus, setCenterFocus] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const pickingRef = useRef(false);
  useEffect(() => {
    pickingRef.current = picking;
    const canvas = mapRef.current?.getCanvasContainer();
    if (canvas) canvas.style.cursor = picking ? 'crosshair' : '';
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const places = useLiveQuery(() => getDb().places.toArray(), []);
  const catches = useLiveQuery(() => getDb().catches.toArray(), []);
  const features = useMemo(() => toFeatures(places ?? [], catches ?? []), [places, catches]);
  // Heatmap der gelandeten Fische (P2); Wahl wird pro Gerät gemerkt
  // Mit Ziel aus dem Fangbuch ohne Heatmap starten, sonst wäre das gesuchte Fang-Symbol ausgeblendet
  const [heat, setHeat] = useState(() => {
    const st = location.state as MapFocusState | null;
    return readHeat() && !st?.focusCatch && !st?.assignWater;
  });
  const heatRef = useRef(heat);
  const heatCount = useMemo(
    () => (catches ?? []).filter((c) => !c.deletedAt && c.outcome === 'caught' && c.position).length,
    [catches],
  );
  const heatEmpty = heat && !!catches && heatCount === 0;
  // Aus der Alt-App übernommen (PLAN §1.2): unter 30 Punkten sind Häufungen oft Zufall
  const heatFew = heat && heatCount > 0 && heatCount < HEAT_MIN;
  const meFc = useMemo<OverlayData['me']>(
    () =>
      geo.fix
        ? {
            type: 'FeatureCollection',
            features: [
              circlePolygon(geo.fix.lng, geo.fix.lat, geo.fix.accuracy),
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [geo.fix.lng, geo.fix.lat] },
              },
            ],
          }
        : EMPTY,
    [geo.fix],
  );
  const overlay = useRef<OverlayData>({ places: EMPTY, catches: EMPTY, me: EMPTY });

  // Karte einmal anlegen
  useEffect(() => {
    if (!container.current) return;
    const view = readView();
    const map = new MlMap({
      container: container.current,
      style: navigator.onLine ? basemap.styleUrl(theme) : fallbackStyle(theme),
      center: view.center,
      zoom: view.zoom,
      attributionControl: false,
      maxPitch: 0,
      dragRotate: false,
      locale: {
        'NavigationControl.ZoomIn': de.map.zoomIn,
        'NavigationControl.ZoomOut': de.map.zoomOut,
        'AttributionControl.ToggleAttribution': de.map.toggleAttribution,
      },
    });
    map.touchZoomRotate.disableRotation();
    // OSM-Vermerk (Pflicht laut OSMF-Richtlinie): beim Start sichtbar, klappt nach dem ersten Verschieben
    // (MapLibre) oder nach 5 s zum ⓘ-Knopf ein; ein Tipp darauf zeigt ihn wieder. Zusätzlich unter Mehr → Über.
    const attribution = new AttributionControl({ compact: true });
    map.addControl(attribution, 'bottom-right');
    const collapseTimer = window.setTimeout(() => {
      container.current
        ?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
        ?.classList.remove('maplibregl-compact-show');
    }, ATTRIBUTION_COLLAPSE_MS);
    mapRef.current = map;
    window.__fangpunktMap = map;

    // Wurde der aktuelle Stil schon geladen? Nur Fehler davor sind Stilfehler (→ Ersatzstil).
    let styleLoaded = false;
    const setStyle = map.setStyle.bind(map);
    map.setStyle = ((...args: Parameters<typeof setStyle>) => {
      styleLoaded = false;
      return setStyle(...args);
    }) as typeof map.setStyle;
    map.on('style.load', () => {
      styleLoaded = true;
      for (const { id, textField } of germanTextFields(
        map.getStyle().layers as Parameters<typeof germanTextFields>[0],
      ))
        map.setLayoutProperty(id, 'text-field', textField);
      const adj = basemap.adjustments(themeRef.current);
      for (const id of adj.hideLayers ?? [])
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      // Nur Eigenschaften, die zum Ebenentyp passen: Ein Fehler hier würde das Einhängen der eigenen Ebenen verhindern
      const fits = (type: string, prop: string) =>
        type === 'symbol' ? /^(text|icon)-/.test(prop) : prop.startsWith(`${type}-`);
      const layers = map.getStyle().layers;
      for (const [match, prop, value] of adj.paint ?? [])
        for (const l of layers)
          if ((typeof match === 'string' ? l.id === match : match.test(l.id)) && fits(l.type, prop))
            map.setPaintProperty(l.id, prop as never, value as never);
      void addOverlays(map, overlay.current, basemap.glyphFont).then(() => {
        setHeatmap(map, heatRef.current);
        const m = waterRef.current;
        if (m)
          addWaterLayers(
            map,
            water.tilesUrl(m),
            `${m.source.attribution} (${m.source.license})`,
            themeRef.current,
          );
        setReady(true);
      });
    });
    map.on('error', (e) => {
      // Stil nicht ladbar (z. B. offline oder Anbieter gestört): auf schlichten Hintergrund wechseln.
      // Fehler einzelner Datenquellen (Kacheln, Gewässer) zählen nicht – sonst entsteht eine Schleife.
      const fromSource = 'sourceId' in e && !!(e as { sourceId?: string }).sourceId;
      if (!styleLoaded && !fromSource) {
        setBaseFailed(true);
        setUsingFallback(true);
        map.setStyle(fallbackStyle(themeRef.current));
      }
    });
    map.on('moveend', () => {
      try {
        const c = map.getCenter();
        localStorage.setItem(VIEW_KEY, JSON.stringify({ lng: c.lng, lat: c.lat, zoom: map.getZoom() }));
      } catch {
        // Speichern der Ansicht ist optional
      }
    });
    map.on('click', (e: MapMouseEvent) => {
      // Fangstelle wählen: genau der angetippte Punkt, auch auf dem Wasser (statt Gewässerprofil)
      if (pickingRef.current) {
        setPicking(false);
        const near = waterContext(map, e.point);
        if (near.water) setSelectedWid(near.water.wid);
        setSheet({
          kind: 'catchForm',
          context: { position: { lat: e.lngLat.lat, lng: e.lngLat.lng, source: 'map-tap' }, ...near },
        });
        return;
      }
      const box: [[number, number], [number, number]] = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10],
      ];
      // Bei überlappenden Symbolen gewinnt das, dessen Mittelpunkt dem Finger am nächsten liegt
      const hits = map.queryRenderedFeatures(box, {
        layers: INTERACTIVE_LAYERS.filter((l) => map.getLayer(l)),
      });
      const dist = (f: (typeof hits)[number]) => {
        const c = map.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
        // Pins stehen mit der Spitze auf dem Punkt; ihr sichtbarer Mittelpunkt liegt ~18 px darüber
        const dy = f.properties.kind === 'place-spot' ? 18 : 0;
        return Math.hypot(c.x - e.point.x, c.y - dy - e.point.y);
      };
      const hit = hits.sort((a, b) => dist(a) - dist(b))[0];
      if (hit?.layer.id === LAYERS.clusters) {
        const src = map.getSource('fp-catches') as import('maplibre-gl').GeoJSONSource;
        void src
          .getClusterExpansionZoom(Number(hit.properties.cluster_id))
          .then((z) =>
            map.easeTo({ center: (hit.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z }),
          );
        return;
      }
      if (hit?.layer.id === LAYERS.places) return setSheet({ kind: 'place', id: String(hit.properties.id) });
      if (hit?.layer.id === LAYERS.catches) return setSheet({ kind: 'catch', id: String(hit.properties.id) });
      // Gewässer: Fläche unter dem Finger, sonst Fließgewässer im Umkreis (Flüsse laufen oft durch Seen)
      const info = waterAt(map, e.point);
      if (info) {
        setSelectedWid(info.wid);
        return setSheet({ kind: 'water', info, lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
      setSheet({ kind: 'new', lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    return () => {
      window.clearTimeout(collapseTimer);
      map.remove();
      mapRef.current = null;
      delete window.__fangpunktMap;
    };
    // Nur beim ersten Rendern; Theme- und Netzwechsel behandeln eigene Effekte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme- oder Netzwechsel: passenden Stil laden (eigene Ebenen hängt 'style.load' wieder ein)
  const lastStyle = useRef<string>('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wantBase = online;
    const key = `${wantBase ? 'base' : 'fallback'}-${theme}`;
    if (!lastStyle.current) {
      lastStyle.current = key;
      return;
    }
    if (key === lastStyle.current) return;
    lastStyle.current = key;
    setReady(false);
    setBaseFailed(false);
    setUsingFallback(!wantBase);
    map.setStyle(wantBase ? basemap.styleUrl(theme) : fallbackStyle(theme), { diff: false });
  }, [theme, online, basemap]);

  // Gewässerdaten: Manifest laden; ohne Manifest bleibt die Karte ohne Gewässerebene nutzbar
  useEffect(() => {
    let cancelled = false;
    void water.loadManifest().then((m) => {
      if (cancelled || !m) return;
      waterRef.current = m;
      setWaterManifest(m);
    });
    return () => {
      cancelled = true;
    };
  }, [water, online]);

  // Gewässerebene einhängen, sobald Manifest UND eigene Ebenen bereit sind – egal, was zuerst fertig ist.
  // (map.isStyleLoaded() taugt dafür nicht: es ist false, solange noch Kacheln laden.)
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && waterManifest)
      addWaterLayers(
        map,
        water.tilesUrl(waterManifest),
        `${waterManifest.source.attribution} (${waterManifest.source.license})`,
        themeRef.current,
      );
  }, [ready, waterManifest, water]);

  // Ausgewähltes Gewässer hervorheben, solange sein Profil oder das Anlegen daran offen ist
  const sheetOnWater =
    sheet?.kind === 'water' ||
    ((sheet?.kind === 'new' || sheet?.kind === 'placeForm') && !!sheet.water) ||
    (sheet?.kind === 'catchForm' && !!sheet.context?.water);
  const highlightWid = sheetOnWater ? selectedWid : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightWid || !ready || !map.getSource(WATER.source)) return;
    const ids = ['areas', 'lines'].map((sourceLayer) => ({
      source: WATER.source,
      sourceLayer,
      id: highlightWid,
    }));
    ids.forEach((f) => map.setFeatureState(f, { sel: true }));
    return () => ids.forEach((f) => map.getSource(WATER.source) && map.setFeatureState(f, { sel: false }));
  }, [highlightWid, ready]);

  function onSearchPick(r: SearchResult) {
    const map = mapRef.current;
    setSheet(null);
    if (!map) return;
    const zoom = r.isPlace ? (r.kind === 'place:city' ? 11 : 12.5) : 14;
    map.flyTo({ center: [r.lng, r.lat], zoom, essential: true });
    if (!r.wid) return;
    const wid = r.wid;
    // Nach jedem nachgeladenen Kartenteil erneut suchen, bis das Gewässer da ist (langsame Netze/Geräte)
    const tryOpen = () => {
      for (const sourceLayer of ['areas', 'lines']) {
        if (!map.getSource(WATER.source)) return false;
        const f = map.querySourceFeatures(WATER.source, {
          sourceLayer,
          filter: ['==', ['get', 'wid'], wid],
        })[0];
        const info = f && waterFromTile(f.properties, sourceLayer === 'lines');
        if (info) {
          setSelectedWid(wid);
          setSheet({ kind: 'water', info, lat: r.lat, lng: r.lng });
          return true;
        }
      }
      return false;
    };
    const onData = () => {
      if (!map.isMoving() && tryOpen()) stop();
    };
    const stop = () => {
      map.off('sourcedata', onData);
      map.off('idle', onData);
      clearTimeout(timer);
    };
    const timer = setTimeout(stop, 15_000);
    map.on('sourcedata', onData);
    map.on('idle', onData);
  }

  // Daten in die Ebenen (und für den nächsten Stilwechsel merken)
  useEffect(() => {
    overlay.current = { places: features.placeFc, catches: features.catchFc, me: meFc };
    const map = mapRef.current;
    if (map && ready) setOverlayData(map, overlay.current);
  }, [features, meFc, ready]);

  useEffect(() => {
    if (locateOnStart !== true || autoChecked.current) return;
    autoChecked.current = true;
    const st = location.state as MapFocusState | null;
    // Mit Ziel aus dem Fangbuch nicht vom Ziel wegspringen
    if (st?.focusCatch || st?.assignWater) centeredOnFix.current = true;
    void geolocationDenied().then((denied) => {
      if (denied) return;
      autoLocated.current = true;
      setLocating(true);
    });
  }, [locateOnStart, location.state]);

  // Beim ersten Standort hinzoomen
  useEffect(() => {
    if (!geo.fix || centeredOnFix.current) return;
    centeredOnFix.current = true;
    centeredThisLaunch = true;
    mapRef.current?.easeTo({
      center: [geo.fix.lng, geo.fix.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
    });
  }, [geo.fix]);

  useEffect(() => {
    heatRef.current = heat;
    const map = mapRef.current;
    if (map && ready) setHeatmap(map, heat);
    try {
      localStorage.setItem(HEAT_KEY, heat ? '1' : '0');
    } catch {
      // nur Komfort
    }
  }, [heat, ready]);

  function onLocate() {
    autoLocated.current = false;
    if (locating) {
      setLocating(false);
      geo.reset();
      centeredOnFix.current = false;
      return;
    }
    if (locHintSeen() || locateOnStart) setLocating(true);
    else setSheet({ kind: 'locate' });
  }

  /** Zurück zum eigenen Standort; ist er noch nicht bekannt, wird er eingeschaltet und beim ersten Wert angefahren. */
  function onRecenter() {
    const map = mapRef.current;
    if (locating && geo.fix && map) {
      map.easeTo({ center: [geo.fix.lng, geo.fix.lat], zoom: Math.max(map.getZoom(), 14) });
      return;
    }
    centeredOnFix.current = false;
    if (!locating) onLocate();
  }

  async function deletePlace(id: string) {
    const p = await repo('places').get(id);
    if (!p) return;
    await repo('places').remove(id);
    setSheet(null);
    setToast({ text: de.map.deleted(de.map.placeTypes[p.type]), undo: () => repo('places').restore(id) });
  }

  async function deleteCatch(id: string) {
    await repo('catches').remove(id);
    setSheet(null);
    setToast({ text: de.catches.deleted, undo: () => repo('catches').restore(id) });
  }

  /** „Fang erfassen": am eigenen Standort, falls er gerade angezeigt wird, sonst in der Kartenmitte. */
  /** Knopf „Fang erfassen": Antipp-Modus an/aus */
  function onAddCatch() {
    setSheet(null);
    setPicking((p) => !p);
  }

  /** Im Antipp-Modus: statt zu tippen den eigenen Standort nehmen (nur wenn er gerade angezeigt wird) */
  /** Fangstelle ohne Tippen: eigener Standort oder Kartenmitte (Tastatur, Fadenkreuz). */
  function addCatchAtMyLocation(where: 'gps' | 'center' = 'gps') {
    setPicking(false);
    const map = mapRef.current;
    const fix = where === 'gps' && locating ? geo.fix : undefined;
    const c = fix ?? map?.getCenter();
    if (!c) return;
    const near = map ? waterContext(map, map.project([c.lng, c.lat])) : {};
    if (near.water) setSelectedWid(near.water.wid);
    setSheet({
      kind: 'catchForm',
      context: {
        position: fix
          ? { lat: fix.lat, lng: fix.lng, accuracyM: Math.round(fix.accuracy), source: 'gps' }
          : { lat: c.lat, lng: c.lng, source: 'map-tap' },
        ...near,
      },
    });
  }

  // Aus dem Fangbuch: Eintrag auf der Karte zeigen, sobald Karte und Daten bereit sind
  const focusCatch = (location.state as MapFocusState | null)?.focusCatch;
  useEffect(() => {
    const map = mapRef.current;
    const c = focusCatch ? catches?.find((x) => x.id === focusCatch) : undefined;
    if (!map || !ready || !focusCatch || !catches) return;
    void navigate('.', { replace: true, state: null });
    if (!c) return;
    if (c.position)
      map.jumpTo({ center: [c.position.lng, c.position.lat], zoom: Math.max(map.getZoom(), 15) });
    // Sheet erst nach dem Sprung öffnen (nicht synchron im Effekt)
    queueMicrotask(() => setSheet({ kind: 'catch', id: c.id }));
  }, [focusCatch, catches, ready, navigate]);

  // Aus dem Fangbuch: Gewässer nachträglich zuordnen. Erst hinspringen, dann nach dem Laden der Kacheln suchen.
  const assignFor = (location.state as MapFocusState | null)?.assignWater;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !assignFor || !catches) return;
    void navigate('.', { replace: true, state: null });
    const c = catches.find((x) => x.id === assignFor);
    const pos = c?.position;
    if (!c || !pos) return;
    map.jumpTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 15) });
    queueMicrotask(() => setSheet({ kind: 'assignWater', id: c.id }));
    map.once('idle', () => {
      const candidates = waterCandidates(map, map.project([pos.lng, pos.lat]));
      setSheet((s) => (s?.kind === 'assignWater' && s.id === c.id ? { ...s, candidates } : s));
    });
  }, [assignFor, catches, ready, navigate]);

  async function assignWater(id: string, w?: WaterInfo) {
    await repo('catches').update(id, {
      waterId: w?.wid,
      waterSnapshot: w
        ? {
            ...(w.name ? { name: w.name } : {}),
            ...(waterPlace(w) ? { place: waterPlace(w) } : {}),
          }
        : undefined,
    });
    setSheet(null);
    setToast({ text: w ? de.catchForm.assigned(w.name ?? de.water.unnamed) : de.catchForm.assignRemoved });
  }

  const sheetPlace =
    sheet?.kind === 'place' ? places?.find((p) => p.id === sheet.id && !p.deletedAt) : undefined;
  const sheetCatch = sheet?.kind === 'catch' ? catches?.find((c) => c.id === sheet.id) : undefined;

  let sheetTitle = '';
  let sheetBody: React.ReactNode = null;
  if (sheet?.kind === 'new') {
    sheetTitle = de.map.newHereTitle;
    sheetBody = (
      <NewHere
        lat={sheet.lat}
        lng={sheet.lng}
        {...(sheet.water ? { waterName: sheet.water.name ?? de.water.unnamed } : {})}
        onPick={(type) =>
          setSheet({
            kind: 'placeForm',
            type,
            lat: sheet.lat,
            lng: sheet.lng,
            ...(sheet.water ? { water: sheet.water } : {}),
          })
        }
        onCatch={() => {
          const map = mapRef.current;
          const near = map ? waterContext(map, map.project([sheet.lng, sheet.lat])) : {};
          setSheet({
            kind: 'catchForm',
            context: {
              position: { lat: sheet.lat, lng: sheet.lng, source: 'map-tap' },
              ...(sheet.water ? { water: sheet.water } : near),
            },
          });
        }}
      />
    );
  } else if (sheet?.kind === 'catchForm') {
    const existing = sheet.id ? catches?.find((c) => c.id === sheet.id) : undefined;
    sheetTitle = sheet.id ? de.catchForm.editTitle : de.catchForm.newTitle;
    sheetBody =
      sheet.id && !existing ? null : (
        <CatchForm
          key={sheet.id ?? 'neu'}
          {...(existing ? { initial: existing } : {})}
          {...(sheet.context ? { context: sheet.context } : {})}
          {...(locating && geo.fix ? { myLocation: geo.fix } : {})}
          onCancel={() => setSheet(null)}
          onSaved={(c) => {
            setSheet(null);
            setToast({ text: de.catchForm.saved(de.map.outcomes[c.outcome]) });
          }}
        />
      );
  } else if (sheet?.kind === 'assignWater') {
    const target = catches?.find((c) => c.id === sheet.id);
    sheetTitle = de.catchForm.assignTitle;
    sheetBody = target ? (
      <div className={styles.form}>
        {!sheet.candidates ? (
          <p className="muted">{de.catchForm.assignSearching}</p>
        ) : sheet.candidates.length === 0 ? (
          <Notice>{de.catchForm.assignNone}</Notice>
        ) : (
          <>
            <p>{de.catchForm.assignIntro}</p>
            <div className={styles.choiceList}>
              {sheet.candidates.map((w) => (
                <Button
                  key={w.wid}
                  variant={w.wid === target.waterId ? 'primary' : 'secondary'}
                  onClick={() => void assignWater(target.id, w)}
                >
                  {de.catchForm.waterOption(w.name ?? de.water.unnamed, de.water.types[w.type])}
                </Button>
              ))}
            </div>
          </>
        )}
        {target.waterId && (
          <Button variant="ghost" onClick={() => void assignWater(target.id)}>
            {de.catchForm.assignRemove}
          </Button>
        )}
      </div>
    ) : null;
  } else if (sheet?.kind === 'placeForm') {
    const existing = sheet.id ? places?.find((p) => p.id === sheet.id) : undefined;
    sheetTitle = sheet.id
      ? de.map.editPlaceTitle(de.map.placeTypes[sheet.type])
      : de.map.newPlaceTitle(de.map.placeTypes[sheet.type]);
    sheetBody = (
      <PlaceForm
        initial={existing ?? { type: sheet.type }}
        {...(sheet.water ? { water: sheet.water } : {})}
        lat={sheet.lat}
        lng={sheet.lng}
        onCancel={() => setSheet(null)}
        onSaved={(p) => {
          setSheet(null);
          setToast({ text: de.map.saved(de.map.placeTypes[p.type]) });
        }}
      />
    );
  } else if (sheetPlace) {
    sheetTitle = de.map.placeTypes[sheetPlace.type];
    sheetBody = (
      <PlaceDetails
        place={sheetPlace}
        onEdit={() =>
          setSheet({
            kind: 'placeForm',
            type: sheetPlace.type,
            lat: sheetPlace.position.lat,
            lng: sheetPlace.position.lng,
            id: sheetPlace.id,
          })
        }
        onDelete={() => void deletePlace(sheetPlace.id)}
        onAddCatch={() =>
          setSheet({
            kind: 'catchForm',
            context: {
              position: { lat: sheetPlace.position.lat, lng: sheetPlace.position.lng, source: 'place' },
              placeId: sheetPlace.id,
              ...(sheetPlace.waterId
                ? {
                    water: {
                      wid: sheetPlace.waterId,
                      ...(sheetPlace.waterSnapshot?.name ? { name: sheetPlace.waterSnapshot.name } : {}),
                    },
                  }
                : {}),
            },
          })
        }
      />
    );
  } else if (sheetCatch) {
    sheetTitle = de.map.outcomes[sheetCatch.outcome];
    sheetBody = (
      <CatchDetails
        item={sheetCatch}
        onEdit={() => setSheet({ kind: 'catchForm', id: sheetCatch.id })}
        onDelete={() => void deleteCatch(sheetCatch.id)}
      />
    );
  } else if (sheet?.kind === 'water') {
    const { info } = sheet;
    sheetTitle = info.name ?? de.water.unnamed;
    sheetBody = (
      <WaterProfile
        info={info}
        manifest={waterManifest}
        counts={{
          places: places?.filter((p) => p.waterId === info.wid && !p.deletedAt).length ?? 0,
          catches: catches?.filter((c) => c.waterId === info.wid && !c.deletedAt).length ?? 0,
        }}
        onMarkHere={() =>
          setSheet({
            kind: 'new',
            lat: sheet.lat,
            lng: sheet.lng,
            water: { wid: info.wid, ...(info.name ? { name: info.name } : {}) },
          })
        }
      />
    );
  } else if (sheet?.kind === 'search') {
    sheetTitle = de.search.title;
    sheetBody = (
      <SearchSheet water={water} manifest={waterManifest} near={sheet.near} onPick={onSearchPick} />
    );
  } else if (sheet?.kind === 'legend') {
    sheetTitle = de.map.legendTitle;
    sheetBody = <Legend clustersLabeled={!usingFallback} />;
  } else if (sheet?.kind === 'locate') {
    sheetTitle = de.map.locateTitle;
    sheetBody = (
      <>
        <p>{de.map.locateText}</p>
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={() => setSheet(null)}>
            {de.map.cancel}
          </Button>
          <Button
            onClick={() => {
              try {
                localStorage.setItem(LOC_HINT_KEY, '1');
              } catch {
                // Hinweis erscheint dann beim nächsten Mal erneut
              }
              setSheet(null);
              setLocating(true);
            }}
          >
            {de.map.locateConfirm}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className={styles.wrap}>
      <div ref={container} className={styles.map} role="region" aria-label={de.map.label} />
      <button
        type="button"
        className={styles.searchPill}
        onClick={() => {
          const c = mapRef.current?.getCenter();
          setSheet({ kind: 'search', near: { lat: c?.lat ?? 51.2, lng: c?.lng ?? 10.4 } });
        }}
      >
        <SearchIcon />
        <span>{de.search.open}</span>
      </button>
      <div className={styles.status}>
        {!ready && <Notice>{de.map.loading}</Notice>}
        {ready && usingFallback && (
          <Notice tone="warning">{baseFailed && online ? de.map.loadError : de.map.offline}</Notice>
        )}
        {locating && geo.error && <Notice tone="error">{de.map.locErrors[geo.error]}</Notice>}
        {locating && !geo.error && !geo.fix && <Notice>{de.map.locating}</Notice>}
        {ready && heatEmpty && <Notice>{de.map.heatmapEmpty}</Notice>}
        {ready && heatFew && <Notice>{de.map.heatmapFew(heatCount, HEAT_MIN)}</Notice>}
      </div>
      <div className={styles.controls}>
        <IconButton
          className={[styles.control, locating ? styles.controlOn : ''].join(' ')}
          label={locating ? de.map.locateStop : de.map.locate}
          aria-pressed={locating}
          icon={<LocateIcon />}
          onClick={onLocate}
        />
        <IconButton
          className={styles.control}
          label={de.map.recenter}
          icon={<RecenterIcon />}
          onClick={onRecenter}
        />
        <IconButton
          className={[styles.control, heat ? styles.controlOn : ''].join(' ')}
          label={heat ? de.map.heatmapOff : de.map.heatmapOn}
          aria-pressed={heat}
          icon={<HeatIcon />}
          onClick={() => setHeat((h) => !h)}
        />
        <IconButton
          className={styles.control}
          label={de.map.legend}
          icon={<InfoIcon />}
          onClick={() => setSheet({ kind: 'legend' })}
        />
      </div>
      <div className={styles.zoom}>
        <IconButton
          className={styles.control}
          label={de.map.zoomIn}
          icon={<span aria-hidden="true">+</span>}
          onClick={() => mapRef.current?.zoomIn()}
        />
        <IconButton
          className={styles.control}
          label={de.map.zoomOut}
          icon={<span aria-hidden="true">−</span>}
          onClick={() => mapRef.current?.zoomOut()}
        />
      </div>
      {locating && geo.fix && <p className={styles.accuracy}>{de.map.accuracy(geo.fix.accuracy)}</p>}
      {runningSession === null && (
        <button
          type="button"
          className={styles.sessionFab}
          onClick={() =>
            void tryStartSession().then((r) => setToast({ text: r.error ?? de.sessions.started }))
          }
        >
          <span className={styles.playIcon} aria-hidden="true" />
          <span>{de.sessions.start}</span>
        </button>
      )}
      {/* Fadenkreuz nur, solange „Kartenmitte" den Tastaturfokus hat */}
      {picking && centerFocus && <div className={styles.crosshair} aria-hidden="true" />}
      {picking && (
        // Ohne sichtbaren Hinweistext (Wunsch Nutzer 2026-10-22): Screenreader bekommen ihn trotzdem angesagt
        <div className={styles.pickBar}>
          <p className="visually-hidden" role="status">
            {de.map.pickHint}
          </p>
          {locating && geo.fix && (
            <Button variant="secondary" onClick={() => addCatchAtMyLocation('gps')}>
              {de.map.pickMyLocation}
            </Button>
          )}
          {/* Für die Bedienung ohne Maus/Finger: erst sichtbar, wenn er per Tastatur den Fokus bekommt */}
          <Button
            variant="secondary"
            className={styles.pickCenter}
            onFocus={() => setCenterFocus(true)}
            onBlur={() => setCenterFocus(false)}
            onClick={() => addCatchAtMyLocation('center')}
          >
            {de.map.pickCenter}
          </Button>
          <Button variant="secondary" onClick={() => setPicking(false)}>
            {de.map.pickCancel}
          </Button>
        </div>
      )}
      <button
        ref={fabRef}
        type="button"
        className={[styles.fab, picking ? styles.fabActive : ''].join(' ')}
        aria-pressed={picking}
        onClick={onAddCatch}
      >
        <PlusIcon />
        <span>{de.map.addCatchFab}</span>
      </button>

      <Sheet
        open={!!sheet && !!sheetBody}
        title={sheetTitle}
        onClose={() => setSheet(null)}
        returnFocus={fabRef}
      >
        {sheetBody}
      </Sheet>
      {toast && (
        <Toast
          onDismiss={() => setToast(undefined)}
          actions={
            toast.undo && (
              <Button
                variant="ghost"
                onClick={() => {
                  const undo = toast.undo;
                  setToast({ text: de.map.restored });
                  void undo?.();
                }}
              >
                {de.map.undo}
              </Button>
            )
          }
        >
          {toast.text}
        </Toast>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
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

/** Navigationspfeil: „zu meinem Standort“ */
function RecenterIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 4 4 11l7 2 2 7z" />
    </svg>
  );
}

function LocateIcon() {
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
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}
