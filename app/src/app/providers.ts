import { openFreeMap } from '../adapters/openfreemap';
import { openMeteo } from '../adapters/openMeteo';
import { staticWaterData } from '../adapters/staticWaterData';
import type { Providers } from '../ports/providersContext';

/** Zusammenstecken der Anbieter (einzige Stelle, die Adapter kennt). */
export const providers: Providers = {
  basemap: openFreeMap,
  // VITE_WATER_BASE_URL erlaubt externes Hosting (z. B. Objektspeicher); Standard: mit der App ausgeliefert.
  weather: openMeteo(),
  water: staticWaterData(import.meta.env.VITE_WATER_BASE_URL ?? `${import.meta.env.BASE_URL}data/water/`),
};
