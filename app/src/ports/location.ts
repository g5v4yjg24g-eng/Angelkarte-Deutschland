// Port für den Standort des Geräts. Im Browser über `navigator.geolocation`, in der iPhone-App über ein eigenes
// Swift-Modul (CoreLocation): Dort fragt iOS nur einmal nach der Erlaubnis. Über die Web-Ansicht würde bei jedem Start
// eine zweite Abfrage der Web-Ansicht erscheinen. Der Standort verlässt das Gerät nicht.
export interface LocationFix {
  lat: number;
  lng: number;
  /** Genauigkeit in Metern */
  accuracy: number;
  /** Zeitpunkt der Messung (ms seit 1970) */
  t: number;
}
export type LocationError = 'denied' | 'unavailable' | 'timeout';
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface LocationOptions {
  highAccuracy: boolean;
  /** Wie alt ein Standort höchstens sein darf (nur Browser) */
  maxAgeMs?: number;
  /** Wartezeit auf den ersten Standort (nur Browser) */
  timeoutMs?: number;
}

export interface LocationProvider {
  /** Kann das Gerät einen Standort liefern (Browser mit Standort-Funktion bzw. iPhone-App)? */
  supported: boolean;
  /** Stand der Erlaubnis, ohne zu fragen; `unknown`, wenn das Gerät es nicht verrät */
  permission(): Promise<LocationPermission>;
  /** Fortlaufender Standort; liefert die Abmeldung. Fragt bei Bedarf nach der Erlaubnis. */
  watch(
    opts: LocationOptions,
    onFix: (f: LocationFix) => void,
    onError: (e: LocationError) => void,
  ): () => void;
  /** Einmaliger Standort; wirft einen `LocationError` */
  current(opts: LocationOptions): Promise<LocationFix>;
}

/** Ohne Anbieter (z. B. in Tests): kein Standort */
export const NO_LOCATION: LocationProvider = {
  supported: false,
  permission: () => Promise.resolve('unknown'),
  watch: () => () => undefined,
  current: () => Promise.reject<LocationFix>('unavailable' satisfies LocationError),
};
