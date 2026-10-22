import { createContext, useContext } from 'react';
import type { BasemapProvider } from './basemap';
import type { WaterDataProvider } from './waterData';
import type { WeatherProvider } from './weather';
import type { ForecastProvider } from './forecast';

/** Externe Anbieter, die die App-Schicht einsteckt. Features kennen nur diese Schnittstellen. */
export interface Providers {
  basemap: BasemapProvider;
  water: WaterDataProvider;
  weather: WeatherProvider;
  forecast: ForecastProvider;
}

export const ProvidersContext = createContext<Providers | null>(null);

export function useProviders(): Providers {
  const v = useContext(ProvidersContext);
  if (!v) throw new Error('ProvidersProvider fehlt');
  return v;
}
