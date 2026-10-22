// Eigene Kartenebenen (Orte, Fänge, Standort). Werden nach jedem Stilwechsel neu eingehängt.
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { ALL_MARKERS, markerDataUrl } from './markerIcons';

export const LAYERS = {
  places: 'fp-places',
  catches: 'fp-catches',
  clusters: 'fp-catch-clusters',
  clusterCount: 'fp-catch-cluster-count',
  heat: 'fp-catch-heat',
  meAccuracy: 'fp-me-accuracy',
  me: 'fp-me',
} as const;
export const INTERACTIVE_LAYERS = [LAYERS.places, LAYERS.catches, LAYERS.clusters];

export const WATER = {
  source: 'fp-water',
  fill: 'fp-water-fill',
  outline: 'fp-water-outline',
  lineHit: 'fp-water-line-hit',
  lineSel: 'fp-water-line-sel',
} as const;

const minZoomFilter: ExpressionSpecification = ['>=', ['zoom'], ['get', 'mz']];
const selected: ExpressionSpecification = ['boolean', ['feature-state', 'sel'], false];

/**
 * Gewässer aus der Pipeline (PMTiles). Unsichtbar, solange nichts ausgewählt ist – die Basiskarte zeichnet
 * das Wasser schon; diese Ebenen dienen dem Antippen und der Hervorhebung. Liegen unter den eigenen Symbolen.
 */
export function addWaterLayers(map: MlMap, tilesUrl: string, attribution: string, theme: 'light' | 'dark') {
  // Hervorhebung muss sich vom Wasser der Basiskarte abheben (hell: Hellblau, dunkel: Tiefblau)
  const sel = theme === 'dark' ? '#7FE0EE' : '#0F5C6E';
  if (!map.getSource(WATER.source))
    map.addSource(WATER.source, {
      type: 'vector',
      url: `pmtiles://${tilesUrl}`,
      promoteId: 'wid',
      attribution,
    });
  const before = map.getLayer(LAYERS.meAccuracy) ? LAYERS.meAccuracy : undefined;
  const add = (layer: Parameters<MlMap['addLayer']>[0]) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, before);
  };
  add({
    id: WATER.fill,
    type: 'fill',
    source: WATER.source,
    'source-layer': 'areas',
    filter: minZoomFilter,
    paint: {
      'fill-color': theme === 'dark' ? '#4FB8CC' : '#1F7A8C',
      'fill-opacity': ['case', selected, 0.28, 0],
    },
  });
  add({
    id: WATER.outline,
    type: 'line',
    source: WATER.source,
    'source-layer': 'areas',
    filter: minZoomFilter,
    paint: { 'line-color': sel, 'line-width': 2.5, 'line-opacity': ['case', selected, 1, 0] },
  });
  add({
    id: WATER.lineHit,
    type: 'line',
    source: WATER.source,
    'source-layer': 'lines',
    filter: minZoomFilter,
    paint: { 'line-color': '#0F5C6E', 'line-width': 14, 'line-opacity': 0 },
  });
  add({
    id: WATER.lineSel,
    type: 'line',
    source: WATER.source,
    'source-layer': 'lines',
    filter: minZoomFilter,
    paint: { 'line-color': sel, 'line-width': 4, 'line-opacity': ['case', selected, 1, 0] },
  });
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Schlichter Ersatzstil ohne Netz: nur Hintergrund, damit eigene Markierungen sichtbar bleiben. */
export function fallbackStyle(theme: 'light' | 'dark'): StyleSpecification {
  return {
    version: 8,
    name: 'fangpunkt-offline',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': theme === 'dark' ? '#2C5550' : '#e3ebec' },
      },
    ],
  };
}

// Symbole einmal rastern (72 px, Pixelverhältnis 2 → 36 CSS-Pixel), dann bei jedem Stil wiederverwenden.
let iconCache: Promise<Map<string, ImageData>> | undefined;
function rasterIcons(): Promise<Map<string, ImageData>> {
  iconCache ??= Promise.all(
    ALL_MARKERS.map(
      (kind) =>
        new Promise<[string, ImageData]>((resolve, reject) => {
          const img = new Image(72, 72);
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = c.height = 72;
            const ctx = c.getContext('2d');
            if (!ctx) return reject(new Error('Canvas nicht verfügbar'));
            ctx.drawImage(img, 0, 0, 72, 72);
            resolve([kind, ctx.getImageData(0, 0, 72, 72)]);
          };
          img.onerror = () => reject(new Error(`Symbol ${kind} nicht ladbar`));
          img.src = markerDataUrl(kind);
        }),
    ),
  ).then((entries) => new Map(entries));
  return iconCache;
}

export interface OverlayData {
  places: FeatureCollection;
  catches: FeatureCollection;
  me: FeatureCollection;
}

export async function addOverlays(map: MlMap, data: OverlayData, glyphFont: string[]) {
  const icons = await rasterIcons();
  for (const [kind, img] of icons) if (!map.hasImage(kind)) map.addImage(kind, img, { pixelRatio: 2 });

  if (!map.getSource('fp-me')) map.addSource('fp-me', { type: 'geojson', data: data.me });
  if (!map.getSource('fp-places')) map.addSource('fp-places', { type: 'geojson', data: data.places });
  if (!map.getSource('fp-catches'))
    map.addSource('fp-catches', {
      type: 'geojson',
      data: data.catches,
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 15,
    });

  // Heatmap: nur gelandete Fische, eigene ungeclusterte Quelle; unter allen Symbolen, standardmäßig aus
  if (!map.getSource('fp-heat')) map.addSource('fp-heat', { type: 'geojson', data: data.catches });
  if (!map.getLayer(LAYERS.heat))
    map.addLayer({
      id: LAYERS.heat,
      type: 'heatmap',
      source: 'fp-heat',
      filter: ['==', ['get', 'kind'], 'catch-caught'],
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.25, 15, 0.8],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 22, 16, 36],
        // Von durchsichtig über Gelb nach Rot: auf heller und dunkler Karte erkennbar
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(255,214,102,0)',
          0.2,
          'rgba(255,214,102,0.55)',
          0.5,
          'rgba(244,140,40,0.75)',
          0.8,
          'rgba(214,60,30,0.85)',
          1,
          'rgba(160,20,40,0.9)',
        ],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.85, 17, 0.35],
      },
    });
  if (!map.getLayer(LAYERS.meAccuracy))
    map.addLayer({
      id: LAYERS.meAccuracy,
      type: 'fill',
      source: 'fp-me',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#2F7FE0', 'fill-opacity': 0.14, 'fill-outline-color': '#2F7FE0' },
    });
  if (!map.getLayer(LAYERS.clusters))
    map.addLayer({
      id: LAYERS.clusters,
      type: 'circle',
      source: 'fp-catches',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#D9731F',
        'circle-opacity': 0.92,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 25],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5,
      },
    });
  // Beschriftung nur, wenn der Stil Schriften anbietet (der Offline-Ersatzstil tut das nicht)
  if (!map.getLayer(LAYERS.clusterCount) && map.getStyle().glyphs)
    map.addLayer({
      id: LAYERS.clusterCount,
      type: 'symbol',
      source: 'fp-catches',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': glyphFont, 'text-size': 13 },
      paint: { 'text-color': '#ffffff' },
    });
  if (!map.getLayer(LAYERS.catches))
    map.addLayer({
      id: LAYERS.catches,
      type: 'symbol',
      source: 'fp-catches',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'kind'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'sort'],
      },
    });
  if (!map.getLayer(LAYERS.places))
    map.addLayer({
      id: LAYERS.places,
      type: 'symbol',
      source: 'fp-places',
      layout: {
        'icon-image': ['get', 'kind'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': ['match', ['get', 'kind'], 'place-spot', 'bottom', 'center'],
      },
    });
  if (!map.getLayer(LAYERS.me))
    map.addLayer({
      id: LAYERS.me,
      type: 'circle',
      source: 'fp-me',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 8,
        'circle-color': '#2F7FE0',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
}

export function setOverlayData(map: MlMap, data: Partial<OverlayData>) {
  const set = (id: string, fc?: FeatureCollection) =>
    fc && (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
  set('fp-places', data.places);
  set('fp-catches', data.catches);
  set('fp-heat', data.catches);
  set('fp-me', data.me);
}

/** Heatmap ein/aus; die Zahlenkreise fassen dasselbe zusammen und entfallen solange. */
export function setHeatmap(map: MlMap, on: boolean) {
  const vis = (id: string, v: boolean) =>
    map.getLayer(id) && map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
  vis(LAYERS.heat, on);
  vis(LAYERS.clusters, !on);
  vis(LAYERS.clusterCount, !on);
}

export { EMPTY };
