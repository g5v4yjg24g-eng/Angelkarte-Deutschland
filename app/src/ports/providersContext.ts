import { createContext, useContext } from 'react';
import type { BasemapProvider } from './basemap';
import type { WaterDataProvider } from './waterData';
import type { WeatherProvider } from './weather';
import type { ForecastProvider } from './forecast';
import type { AlertsProvider } from './alerts';
import type { GaugesProvider } from './gauges';

/** Externe Anbieter, die die App-Schicht einsteckt. Features kennen nur diese Schnittstellen. */
export interface Providers {
  basemap: BasemapProvider;
  water: WaterDataProvider;
  weather: WeatherProvider;
  forecast: ForecastProvider;
  alerts: AlertsProvider;
  gauges: GaugesProvider;
}

export const ProvidersContext = createContext<Providers | null>(null);

export function useProviders(): Providers {
  const v = useContext(ProvidersContext);
  if (!v) throw new Error('ProvidersProvider fehlt');
  return v;
}
