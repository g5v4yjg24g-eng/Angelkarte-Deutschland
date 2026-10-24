// Port für die anonyme Nutzungszählung. Übergeben wird nur ein Bereichspfad aus domain/usage.ts.
export interface UsageCounter {
  id: string;
  /** false, wenn nicht eingerichtet (kein Code) – dann wird nie etwas gesendet */
  enabled: boolean;
  pageview(path: string): void;
}
