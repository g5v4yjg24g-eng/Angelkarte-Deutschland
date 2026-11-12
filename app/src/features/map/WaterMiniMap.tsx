// Kartenauszug im Gewässerprofil: dieselbe Basiskarte wie die große Karte, das Gewässer hervorgehoben und der Ausschnitt
// so gewählt, dass es ganz zu sehen ist. Nicht verschiebbar; „Karte öffnen“ springt auf die große Karte.
// Der Ausschnitt entsteht aus den bereits geladenen Kacheln der Pipeline (nichts wird geschätzt).
import 'maplibre-gl/dist/maplibre-gl.css';
import { AttributionControl, LngLatBounds, Map as MlMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import type { Geometry, Position } from 'geojson';
import { de } from '../../i18n/de';
import { useProviders } from '../../ports/providersContext';
import { useEffectiveTheme } from '../../lib/useEffectiveTheme';
import { fallbackStyle } from './mapLayers';
import { germanTextFields } from './germanLabels';
import styles from './WaterProfile.module.css';

setWorkerUrl(workerUrl);

const SRC = 'wm-water';
const FIT_ROUNDS = 4;

type Box = [[number, number], [number, number]];

function extend(b: LngLatBounds, coords: unknown): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number') b.extend(coords as Position as [number, number]);
  else for (const c of coords) extend(b, c);
}

export function WaterMiniMap({
  wid,
  name,
  district,
  isLine,
  center,
  tilesUrl,
  attribution,
  height = 150,
  onOpen,
}: {
  wid: string;
  name?: string | undefined;
  district?: string | undefined;
  isLine: boolean;
  center: { lat: number; lng: number };
  tilesUrl: string;
  attribution: string;
  height?: number;
  onOpen: (bounds: Box) => void;
}) {
  const { basemap } = useProviders();
  const theme = useEffectiveTheme();
  const box = useRef<HTMLDivElement>(null);
  const bounds = useRef<Box>([
    [center.lng - 0.01, center.lat - 0.01],
    [center.lng + 0.01, center.lat + 0.01],
  ]);

  useEffect(() => {
    if (!box.current) return;
    const dark = theme === 'dark';
    const map = new MlMap({
      container: box.current,
      style: navigator.onLine ? basemap.styleUrl(theme) : fallbackStyle(theme),
      center: [center.lng, center.lat],
      zoom: 14,
      interactive: false,
      attributionControl: false,
      maxPitch: 0,
    });
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    // Fließgewässer: alle Abschnitte desselben Namens im selben Kreis, Flächen: genau dieses Gewässer
    const lineFilter = (
      name
        ? ['all', ['==', ['get', 'n'], name], ...(district ? [['==', ['get', 'k'], district]] : [])]
        : ['==', ['get', 'wid'], wid]
    ) as never;
    const areaFilter = ['==', ['get', 'wid'], wid] as never;
    const color = dark ? '#7FE0EE' : '#0F5C6E';
    let rounds = 0;

    const fit = () => {
      if (rounds >= FIT_ROUNDS) return;
      const b = new LngLatBounds();
      const features = [
        ...map.querySourceFeatures(SRC, { sourceLayer: 'areas', filter: areaFilter }),
        ...(isLine ? map.querySourceFeatures(SRC, { sourceLayer: 'lines', filter: lineFilter }) : []),
      ];
      for (const f of features) extend(b, (f.geometry as Geometry & { coordinates?: unknown }).coordinates);
      if (b.isEmpty()) return;
      rounds++;
      bounds.current = [b.getSouthWest().toArray(), b.getNorthEast().toArray()] as Box;
      map.fitBounds(b, { padding: 28, maxZoom: 17, duration: 0 });
    };

    // Quellenvermerk eingeklappt starten (bleibt als Symbol sichtbar), damit er den Kartenauszug nicht verdeckt
    map.once('load', () =>
      box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'),
    );
    map.on('style.load', () => {
      for (const { id, textField } of germanTextFields(
        map.getStyle().layers as Parameters<typeof germanTextFields>[0],
      ))
        map.setLayoutProperty(id, 'text-field', textField);
      for (const id of basemap.adjustments(theme).hideLayers ?? [])
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      if (!map.getSource(SRC))
        map.addSource(SRC, { type: 'vector', url: `pmtiles://${tilesUrl}`, promoteId: 'wid', attribution });
      map.addLayer({
        id: 'wm-fill',
        type: 'fill',
        source: SRC,
        'source-layer': 'areas',
        filter: areaFilter,
        paint: { 'fill-color': color, 'fill-opacity': 0.3 },
      });
      map.addLayer({
        id: 'wm-outline',
        type: 'line',
        source: SRC,
        'source-layer': 'areas',
        filter: areaFilter,
        paint: { 'line-color': color, 'line-width': 2 },
      });
      map.addLayer({
        id: 'wm-line',
        type: 'line',
        source: SRC,
        'source-layer': 'lines',
        filter: lineFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 3.5 },
      });
    });
    // Sobald (weitere) Kacheln da sind, den Ausschnitt auf das ganze Gewässer setzen
    map.on('idle', fit);
    return () => {
      map.remove();
    };
  }, [basemap, theme, wid, name, district, isLine, center.lat, center.lng, tilesUrl, attribution]);

  return (
    <div className={styles.miniMap} style={{ height }}>
      <div ref={box} className={styles.miniCanvas} role="group" aria-label={de.water.mapTitle} />
      <button type="button" className={styles.openMap} onClick={() => onOpen(bounds.current)}>
        {de.water.openMap}
      </button>
    </div>
  );
}
