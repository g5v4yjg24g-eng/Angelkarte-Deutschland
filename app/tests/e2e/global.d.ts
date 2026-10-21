import type { Map as MlMap } from 'maplibre-gl';

declare global {
  interface Window {
    /** Testzugriff auf die Karteninstanz (siehe src/features/map/MapView.tsx). */
    __fangpunktMap?: MlMap;
  }
}
export {};
