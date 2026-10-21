import type { BasemapProvider } from '../ports/basemap';

// OpenFreeMap: kostenlos, ohne Schlüssel, Daten © OpenStreetMap (DATA_SOURCES §1, Spike S2).
// Stilwahl nach Gerätetest (2026-10-21): „positron" war zu grau, „dark" zu dunkel.
// Hell: „liberty" (Wasser kräftig blau); dunkel: „fiord" (Blaugrau) mit deutlich hervorgehobenem Wasser.
export const openFreeMap: BasemapProvider = {
  id: 'openfreemap',
  styleUrl: (theme) => `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'fiord' : 'liberty'}`,
  adjustments: (theme) =>
    theme === 'dark'
      ? {
          paint: [
            ['water', 'fill-color', '#1F5C78'],
            ['waterway', 'line-color', '#3A86AB'],
            ['water_name', 'text-color', '#A9DCEB'],
          ],
        }
      : // Reliefbild der Übersichtsebene: bis ~1 MB zusätzlich (Spike S2), für Angler ohne Nutzen
        { hideLayers: ['natural_earth'] },
  hosts: ['tiles.openfreemap.org'],
  glyphFont: ['Noto Sans Regular'],
};
