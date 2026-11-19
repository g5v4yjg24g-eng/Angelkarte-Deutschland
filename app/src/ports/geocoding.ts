// Port für die Ortssuche (Name → Koordinaten). Gesendet wird nur der getippte Suchbegriff, nie eine Position.
import type { PlaceHit } from '../domain/placeSearch';

export interface GeocodingProvider {
  id: string;
  /** Orte in Deutschland zu einem Suchbegriff; wirft bei Netz- oder Dienstfehlern */
  search(query: string, signal?: AbortSignal): Promise<PlaceHit[]>;
}
