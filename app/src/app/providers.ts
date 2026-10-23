import { openFreeMap } from '../adapters/openfreemap';
import { openMeteo, openMeteoForecast } from '../adapters/openMeteo';
import { staticWaterData } from '../adapters/staticWaterData';
import { brightSkyAlerts } from '../adapters/brightSky';
import { pegelonline } from '../adapters/pegelonline';
import { hygonNrw } from '../adapters/hygonNrw';
import type { Providers } from '../ports/providersContext';

/** Zusammenstecken der Anbieter (einzige Stelle, die Adapter kennt). */
export const providers: Providers = {
  basemap: openFreeMap,
  // VITE_WATER_BASE_URL erlaubt externes Hosting (z. B. Objektspeicher); Standard: mit der App ausgeliefert.
  weather: openMeteo(),
  forecast: openMeteoForecast(),
  alerts: brightSkyAlerts(),
  gauges: pegelonline(),
  gaugesNrw: hygonNrw(),
  water: staticWaterData(import.meta.env.VITE_WATER_BASE_URL ?? `${import.meta.env.BASE_URL}data/water/`),
};
