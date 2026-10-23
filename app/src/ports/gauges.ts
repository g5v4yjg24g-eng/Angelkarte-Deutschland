import type { GaugeStation, Point } from '../domain/gauges';

// Port für Pegelstände. Es wird nie eine Position übertragen: die App lädt die ganze Stationsliste
// und sucht den nächsten Pegel selbst; danach nur die Messreihe dieser einen Station.
export interface GaugesProvider {
  id: string;
  /** Wirft bei Netz- oder Dienstfehlern; null, wenn die Antwort unbrauchbar ist. */
  stations(): Promise<GaugeStation[] | null>;
  /** Wasserstand der letzten 24 h (Stand über Pegelnull, cm). */
  waterLevel24h(uuid: string): Promise<Point[]>;
  /** Wasserstand zwischen zwei Zeitpunkten (ms), höchstens 31 Tage zurück. */
  waterLevelBetween(uuid: string, fromMs: number, toMs: number): Promise<Point[]>;
}

/** Landespegel NRW: Stationen mit letztem Wert und 24-h-Änderung aus der Tagesdatei (keine Position übertragen). */
export interface NrwGaugesProvider {
  id: string;
  stations(): Promise<GaugeStation[] | null>;
  /** Stationen samt vollständiger Reihen der letzten 7 Tage (für den Wasserstand am Fang). */
  withSeries(): Promise<{ stations: GaugeStation[]; series: Map<string, Point[]> } | null>;
}
