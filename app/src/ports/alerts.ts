import type { Alerts, AlertsQuery } from '../domain/alerts';

// Port für amtliche Wetterwarnungen. Der Adapter bekommt nur gerundete Koordinaten.
export interface AlertsProvider {
  id: string;
  /** Wirft bei Netz- oder Dienstfehlern; null, wenn die Antwort unbrauchbar ist. */
  alerts(q: AlertsQuery): Promise<Alerts | null>;
}
