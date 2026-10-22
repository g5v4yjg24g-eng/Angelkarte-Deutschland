import type { Forecast, ForecastQuery } from '../domain/forecast';

// Port für die Wettervorhersage (Bereich „Wetter"). Der Adapter bekommt nur gerundete Koordinaten.
export interface ForecastProvider {
  id: string;
  /** Wirft bei Netz- oder Dienstfehlern; null, wenn die Antwort unbrauchbar ist. */
  forecast(q: ForecastQuery): Promise<Forecast | null>;
}
