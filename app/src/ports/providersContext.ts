import { createContext, useContext } from 'react';
import type { BasemapProvider } from './basemap';
import type { WaterDataProvider } from './waterData';
import type { WeatherProvider } from './weather';
import type { ForecastProvider } from './forecast';
import type { AlertsProvider } from './alerts';
import type { GaugesProvider, NrwGaugesProvider } from './gauges';
import type { UsageCounter } from './usage';
import type { AccountProvider } from './account';
import type { PushProvider } from './push';
import type { HapticsProvider } from './haptics';

/** Externe Anbieter, die die App-Schicht einsteckt. Features kennen nur diese Schnittstellen. */
export interface Providers {
  basemap: BasemapProvider;
  water: WaterDataProvider;
  weather: WeatherProvider;
  forecast: ForecastProvider;
  alerts: AlertsProvider;
  gauges: GaugesProvider;
  gaugesNrw: NrwGaugesProvider;
  usage: UsageCounter;
  account: AccountProvider;
  push: PushProvider;
  haptics: HapticsProvider;
}

export const ProvidersContext = createContext<Providers | null>(null);

export function useProviders(): Providers {
  const v = useContext(ProvidersContext);
  if (!v) throw new Error('ProvidersProvider fehlt');
  return v;
}
