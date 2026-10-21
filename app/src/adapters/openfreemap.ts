import type { BasemapProvider } from '../ports/basemap';

// OpenFreeMap: kostenlos, ohne Schlüssel, Daten © OpenStreetMap (DATA_SOURCES §1, Spike S2).
// Stile „positron" (hell) und „dark" laut S2 ruhiger und leichter als „liberty".
export const openFreeMap: BasemapProvider = {
  id: 'openfreemap',
  styleUrl: (theme) => `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'positron'}`,
  hosts: ['tiles.openfreemap.org'],
  glyphFont: ['Noto Sans Regular'],
};
