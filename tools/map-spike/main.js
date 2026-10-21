// Spike S2: OpenFreeMap-Basiskarte + eigenes Gewässer-Overlay (PMTiles aus tools/water-pipeline).
// URL-Parameter: ?style=liberty|positron|dark  &water=0 (Overlay aus)  &lat=..&lng=..&z=..
import { Map, addProtocol, AttributionControl, NavigationControl } from '/vendor/maplibre/maplibre-gl.mjs';
import { Protocol } from '/vendor/pmtiles/index.js';

const qs = new URLSearchParams(location.search);
const style = qs.get('style') ?? 'liberty';
const withWater = qs.get('water') !== '0';

addProtocol('pmtiles', new Protocol().tile);

const map = new Map({
  container: 'map',
  style: `https://tiles.openfreemap.org/styles/${style}`,
  center: [Number(qs.get('lng') ?? 10.4), Number(qs.get('lat') ?? 51.2)],
  zoom: Number(qs.get('z') ?? 5.3),
  attributionControl: false,
});
map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
map.addControl(new NavigationControl({ showCompass: true }), 'bottom-left');
window.__map = map;   // für measure.mjs
map.once('idle', () => { window.__firstIdleMs = performance.now(); });

map.on('load', () => {
  if (!withWater) return;
  map.addSource('water', { type: 'vector', url: 'pmtiles:///data/water.pmtiles', promoteId: 'wid',
    attribution: 'Gewässer: © OpenStreetMap-Mitwirkende (ODbL)' });
  map.addLayer({ id: 'water-fill', type: 'fill', source: 'water', filter: ['>=', ['zoom'], ['get', 'mz']], 'source-layer': 'areas',
    paint: { 'fill-color': '#0F5C6E', 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.55, 0.25] } });
  map.addLayer({ id: 'water-outline', type: 'line', source: 'water', filter: ['>=', ['zoom'], ['get', 'mz']], 'source-layer': 'areas',
    paint: { 'line-color': '#0F5C6E', 'line-width': 1 } });
  map.addLayer({ id: 'water-lines', type: 'line', source: 'water', filter: ['>=', ['zoom'], ['get', 'mz']], 'source-layer': 'lines',
    paint: { 'line-color': '#0F5C6E', 'line-width': ['match', ['get', 't'], 'stream', 1, 2.5] } });

  let selected = null;
  const LABEL = { lake: 'See', pond: 'Teich', reservoir: 'Stausee/Talsperre', river: 'Fluss', canal: 'Kanal',
    stream: 'Bach', oxbow: 'Altarm', harbour: 'Hafen', other: 'Gewässer (Typ unbekannt)' };
  map.on('click', (e) => {
    // Fläche unter dem Finger hat Vorrang (Flüsse laufen oft als Linie durch Seen); sonst Linie im 12-px-Umkreis.
    const box = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
    const hit = map.queryRenderedFeatures(e.point, { layers: ['water-fill'] })[0]
      ?? map.queryRenderedFeatures(box, { layers: ['water-lines'] })[0];
    if (selected !== null) map.setFeatureState({ source: 'water', sourceLayer: 'areas', id: selected }, { sel: false });
    const sel = document.getElementById('sel');
    if (!hit) { sel.textContent = 'Kein Gewässer an dieser Stelle → hier würde „Neu an dieser Stelle" erscheinen.'; return; }
    if (hit.sourceLayer === 'areas') {
      selected = hit.properties.wid; map.setFeatureState({ source: 'water', sourceLayer: 'areas', id: selected }, { sel: true });
    }
    const p = hit.properties;
    sel.textContent = `${p.n ?? 'Unbenanntes Gewässer'} · ${LABEL[p.t] ?? p.t} · ${p.wid}`;
  });
});
