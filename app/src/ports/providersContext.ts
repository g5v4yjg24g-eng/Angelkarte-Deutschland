import { createContext, useContext } from 'react';
import type { BasemapProvider } from './basemap';
import type { WaterDataProvider } from './waterData';
import type { WeatherProvider } from './weather';
import type { ForecastProvider } from './forecast';
import type { GeocodingProvider } from './geocoding';
import type { AlertsProvider } from './alerts';
import type { GaugesProvider, NrwGaugesProvider } from './gauges';
import type { UsageCounter } from './usage';
import type { AccountProvider } from './account';
import type { PushProvider } from './push';
import type { HapticsProvider } from './haptics';
import type { BackgroundRoute } from './backgroundRoute';
import type { AppLinks } from './appLinks';
import type { LiveActivityProvider } from './liveActivity';
import type { RemindersProvider } from './reminders';
import type { LocationProvider } from './location';

/** Externe Anbieter, die die App-Schicht einsteckt. Features kennen nur diese Schnittstellen. */
export interface Providers {
  basemap: BasemapProvider;
  water: WaterDataProvider;
  weather: WeatherProvider;
  forecast: ForecastProvider;
  /** Ortssuche im Wetter-Bereich (Name → Koordinaten) */
  geocoding?: GeocodingProvider | undefined;
  alerts: AlertsProvider;
  gauges: GaugesProvider;
  gaugesNrw: NrwGaugesProvider;
  usage: UsageCounter;
  account: AccountProvider;
  push: PushProvider;
  haptics: HapticsProvider;
  /** Hintergrund-Route – nur in der iPhone-App, sonst fehlt der Anbieter */
  route?: BackgroundRoute | undefined;
  /** Universal Links (geteilte Profile) – nur in der iPhone-App */
  links?: AppLinks | undefined;
  /** Live Activity der Session auf dem Sperrbildschirm – nur in der iPhone-App */
  liveActivity?: LiveActivityProvider | undefined;
  /** Standort: Browser-Funktion bzw. in der iPhone-App CoreLocation (fragt nur einmal um Erlaubnis) */
  location?: LocationProvider | undefined;
  /** Erinnerungen auf dem Gerät (nur iPhone-App) */
  reminders?: RemindersProvider | undefined;
}

export const ProvidersContext = createContext<Providers | null>(null);

export function useProviders(): Providers {
  const v = useContext(ProvidersContext);
  if (!v) throw new Error('ProvidersProvider fehlt');
  return v;
}
