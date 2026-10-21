import type { BasemapProvider, StyleAdjustments } from '../ports/basemap';

// OpenFreeMap: kostenlos, ohne Schlüssel, Daten © OpenStreetMap (DATA_SOURCES §1, Spike S2).
// Stilwahl nach Gerätetest (2026-10-21): „positron" war zu grau, „dark"/„fiord" zu dunkel bzw. zu blass.
// Beide Themes nutzen „liberty" (Wald, Wiese, Siedlung als eigene Flächen); dunkel wird hier umgefärbt:
// Petrolgrünes Land, sattblaues Wasser, dezente graue Straßen.
const DARK = {
  land: '#2C5550',
  grass: '#33604F',
  wood: '#24493D',
  settlement: '#344850',
  building: '#3E515A',
  water: '#2A3D96',
  waterway: '#3048A6',
  waterLabel: '#A5B4F2',
  roadMinor: '#6E7C80',
  roadMajor: '#8C989B',
  roadMotorway: '#A4ADAB',
  casing: '#36494E',
  path: '#5F7270',
  rail: '#5D6A6D',
  text: '#E6EDEC',
  textSoft: '#C3CFCE',
  halo: 'rgba(22, 42, 40, 0.85)',
} as const;

const dark: StyleAdjustments = {
  hideLayers: ['natural_earth'],
  paint: [
    ['background', 'background-color', DARK.land],
    [/^(park|landcover_grass|landuse_(pitch|track|cemetery|school|hospital))$/, 'fill-color', DARK.grass],
    ['park', 'fill-outline-color', DARK.grass],
    ['park_outline', 'line-color', DARK.grass],
    ['landcover_wood', 'fill-color', DARK.wood],
    ['landcover_wetland', 'fill-opacity', 0.08],
    ['landcover_sand', 'fill-color', '#4A6156'],
    ['landcover_ice', 'fill-color', '#5C7774'],
    ['landuse_residential', 'fill-color', DARK.settlement],
    ['landuse_residential', 'fill-opacity', 0.9],
    ['aeroway_fill', 'fill-color', DARK.settlement],
    [/^aeroway_(runway|taxiway)$/, 'line-color', DARK.roadMinor],
    ['water', 'fill-color', DARK.water],
    [/^waterway_(tunnel|river|other)$/, 'line-color', DARK.waterway],
    // Straßen: erst alle Hüllen und Füllungen, dann die Hauptstraßen heller
    [/_casing$/, 'line-color', DARK.casing],
    [/^(road|tunnel|bridge)_(minor|street|service_track|link|motorway_link)$/, 'line-color', DARK.roadMinor],
    [/^(road|tunnel|bridge)_(secondary_tertiary|trunk_primary)$/, 'line-color', DARK.roadMajor],
    [/^(road|tunnel|bridge)_motorway$/, 'line-color', DARK.roadMotorway],
    [/_path_pedestrian$/, 'line-color', DARK.path],
    [/_rail(_hatching)?$/, 'line-color', DARK.rail],
    ['building', 'fill-color', DARK.building],
    ['building', 'fill-outline-color', DARK.settlement],
    ['building-3d', 'fill-extrusion-color', DARK.building],
    [/^boundary_/, 'line-color', '#8FA19F'],
    // Beschriftungen
    [/^(label_|airport$)/, 'text-color', DARK.text],
    [/^(poi_|highway-name)/, 'text-color', DARK.textSoft],
    [/^(label_|poi_|highway-name|airport$)/, 'text-halo-color', DARK.halo],
    [/^(water_name_|waterway_line_label$)/, 'text-color', DARK.waterLabel],
    [/^(water_name_|waterway_line_label$)/, 'text-halo-color', 'rgba(24, 36, 90, 0.7)'],
  ],
};

export const openFreeMap: BasemapProvider = {
  id: 'openfreemap',
  styleUrl: () => 'https://tiles.openfreemap.org/styles/liberty',
  adjustments: (theme) =>
    theme === 'dark'
      ? dark
      : // Reliefbild der Übersichtsebene: bis ~1 MB zusätzlich (Spike S2), für Angler ohne Nutzen
        { hideLayers: ['natural_earth'] },
  hosts: ['tiles.openfreemap.org'],
  glyphFont: ['Noto Sans Regular'],
};
