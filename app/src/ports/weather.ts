import type { WeatherQuery, WeatherSnapshot } from '../domain/weather';

// Port für Wetter am Fang (ARCHITECTURE §3). Der Adapter bekommt nur gerundete Koordinaten (domain/weather.ts).
export interface WeatherProvider {
  id: string;
  /** null, wenn der Dienst für diese Stunde keine Werte hat. Wirft bei Netz- oder Dienstfehlern. */
  fetchHour(q: WeatherQuery): Promise<WeatherSnapshot | null>;
}
