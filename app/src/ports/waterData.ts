import type { SearchEntry } from '../domain/search';
import type { WaterManifest } from '../domain/water';
import type { StatesFile } from '../domain/states';

// Port für die Gewässerdaten aus der Pipeline (ARCHITECTURE §6). Wo die Dateien liegen, weiß nur der Adapter.
export interface WaterDataProvider {
  id: string;
  /** null, wenn keine Gewässerdaten erreichbar sind (offline beim ersten Start, nicht bereitgestellt). */
  loadManifest(): Promise<WaterManifest | null>;
  /** Absolute URL der PMTiles-Datei. */
  tilesUrl(m: WaterManifest): string;
  /** Einträge eines Suchindex-Teils; [] wenn es den Teil nicht gibt. Wirft bei Netzfehlern. */
  loadSearchShard(m: WaterManifest, key: string): Promise<SearchEntry[]>;
  /**
   * Alle Einträge des Suchindex (für die Detailsuche im Umkreis). Wird einmal geladen und auf dem Gerät gemerkt;
   * `onProgress` meldet den Fortschritt 0…1. Wirft bei Netzfehlern.
   */
  loadAllSearchEntries(m: WaterManifest, onProgress?: (done: number) => void): Promise<SearchEntry[]>;
  /** Landesgrenzen; null, wenn die Daten keine enthalten oder sie nicht erreichbar sind. */
  loadStates(m: WaterManifest): Promise<StatesFile | null>;
}
