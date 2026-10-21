// Deutschlandkarte (M3): Basiskarte über den BasemapProvider, eigene Orte und Fänge, Tipp-Aktion, Standort.
import 'maplibre-gl/dist/maplibre-gl.css';
import { AttributionControl, Map as MlMap, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { useProviders } from '../../ports/providersContext';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import type { PlaceType } from '../../domain/schemas';
import { IconButton, Button } from '../../design/components/Button';
import { Sheet } from '../../design/components/Sheet';
import { Toast } from '../../design/components/Toast';
import { Notice } from '../../design/components/Notice';
import { InfoIcon } from '../../design/icons';
import { useEffectiveTheme } from '../../lib/useEffectiveTheme';
import { useOnline } from '../../lib/useOnline';
import { circlePolygon, toFeatures } from './geojson';
import {
  addOverlays,
  EMPTY,
  fallbackStyle,
  INTERACTIVE_LAYERS,
  LAYERS,
  setOverlayData,
  type OverlayData,
} from './mapLayers';
import { CatchDetails, Legend, NewHere, PlaceDetails, PlaceForm } from './MapSheets';
import { useGeolocation } from './useGeolocation';
import { germanTextFields } from './germanLabels';
import styles from './MapView.module.css';

setWorkerUrl(workerUrl);

type SheetState =
  | { kind: 'new'; lat: number; lng: number }
  | { kind: 'placeForm'; type: PlaceType; lat: number; lng: number; id?: string }
  | { kind: 'place'; id: string }
  | { kind: 'catch'; id: string }
  | { kind: 'legend' }
  | { kind: 'locate' };

const VIEW_KEY = 'fangpunkt.mapView';
const GERMANY = { center: [10.4, 51.2] as [number, number], zoom: 5.2 };
const LOC_HINT_KEY = 'fangpunkt.locHintSeen';

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

declare global {
  interface Window {
    /** Testzugriff (E2E): Karte und Bildschirmkoordinaten eigener Objekte. */
    __fangpunktMap?: MlMap;
  }
}

export default function MapView() {
  const { basemap } = useProviders();
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
  const geo = useGeolocation(locating);
  const centeredOnFix = useRef(false);
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const places = useLiveQuery(() => getDb().places.toArray(), []);
  const catches = useLiveQuery(() => getDb().catches.toArray(), []);
  const features = useMemo(() => toFeatures(places ?? [], catches ?? []), [places, catches]);
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
      locale: { 'NavigationControl.ZoomIn': de.map.zoomIn, 'NavigationControl.ZoomOut': de.map.zoomOut },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    mapRef.current = map;
    window.__fangpunktMap = map;

    map.on('style.load', () => {
      for (const { id, textField } of germanTextFields(
        map.getStyle().layers as Parameters<typeof germanTextFields>[0],
      ))
        map.setLayoutProperty(id, 'text-field', textField);
      void addOverlays(map, overlay.current, basemap.glyphFont).then(() => setReady(true));
    });
    map.on('error', (e) => {
      // Stil nicht ladbar (z. B. offline oder Anbieter gestört): auf schlichten Hintergrund wechseln
      if (!map.isStyleLoaded() || /style/i.test(String(e.error?.message))) {
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
      setSheet({ kind: 'new', lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    return () => {
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

  // Daten in die Ebenen (und für den nächsten Stilwechsel merken)
  useEffect(() => {
    overlay.current = { places: features.placeFc, catches: features.catchFc, me: meFc };
    const map = mapRef.current;
    if (map && ready) setOverlayData(map, overlay.current);
  }, [features, meFc, ready]);

  // Beim ersten Standort hinzoomen
  useEffect(() => {
    if (!geo.fix || centeredOnFix.current) return;
    centeredOnFix.current = true;
    mapRef.current?.easeTo({
      center: [geo.fix.lng, geo.fix.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
    });
  }, [geo.fix]);

  function onLocate() {
    if (locating) {
      setLocating(false);
      geo.reset();
      centeredOnFix.current = false;
      return;
    }
    if (locHintSeen()) setLocating(true);
    else setSheet({ kind: 'locate' });
  }

  async function deletePlace(id: string) {
    const p = await repo('places').get(id);
    if (!p) return;
    await repo('places').remove(id);
    setSheet(null);
    setToast({ text: de.map.deleted(de.map.placeTypes[p.type]), undo: () => repo('places').restore(id) });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 7000);
    return () => clearTimeout(t);
  }, [toast]);

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
        onPick={(type) => setSheet({ kind: 'placeForm', type, lat: sheet.lat, lng: sheet.lng })}
      />
    );
  } else if (sheet?.kind === 'placeForm') {
    const existing = sheet.id ? places?.find((p) => p.id === sheet.id) : undefined;
    sheetTitle = sheet.id
      ? de.map.editPlaceTitle(de.map.placeTypes[sheet.type])
      : de.map.newPlaceTitle(de.map.placeTypes[sheet.type]);
    sheetBody = (
      <PlaceForm
        initial={existing ?? { type: sheet.type }}
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
      />
    );
  } else if (sheetCatch) {
    sheetTitle = de.map.outcomes[sheetCatch.outcome];
    sheetBody = <CatchDetails item={sheetCatch} />;
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
      <div className={styles.status}>
        {!ready && <Notice>{de.map.loading}</Notice>}
        {ready && usingFallback && (
          <Notice tone="warning">{baseFailed && online ? de.map.loadError : de.map.offline}</Notice>
        )}
        {locating && geo.error && <Notice tone="error">{de.map.locErrors[geo.error]}</Notice>}
        {locating && !geo.error && !geo.fix && <Notice>{de.map.locating}</Notice>}
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

      <Sheet open={!!sheet && !!sheetBody} title={sheetTitle} onClose={() => setSheet(null)}>
        {sheetBody}
      </Sheet>
      {toast && (
        <Toast
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
