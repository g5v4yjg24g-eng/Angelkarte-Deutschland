import { useCallback, useEffect, useRef, useState } from 'react';
import { NO_LOCATION, type LocationProvider } from '../../ports/location';
import { useProviders } from '../../ports/providersContext';

export interface GeoFix {
  lng: number;
  lat: number;
  accuracy: number;
}
export type GeoError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Hat das Gerät den Standortzugriff schon dauerhaft verweigert? (ohne Auskunft: unbekannt → false) */
export async function geolocationDenied(loc: LocationProvider = NO_LOCATION): Promise<boolean> {
  return (await loc.permission()) === 'denied';
}

/**
 * Standort nur, solange `active` und die Seite sichtbar ist (kein Hintergrund-Tracking, ARCHITECTURE §5.4).
 * Der Standort verlässt das Gerät nicht.
 */
export function useGeolocation(active: boolean, onError?: (e: GeoError) => void) {
  const loc = useProviders().location ?? NO_LOCATION;
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  const [fix, setFix] = useState<GeoFix>();
  const [error, setError] = useState<GeoError>();
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    if (!active || !visible || !loc.supported) return;
    return loc.watch(
      { highAccuracy: true, maxAgeMs: 10_000, timeoutMs: 20_000 },
      (p) => {
        setError(undefined);
        setFix({ lng: p.lng, lat: p.lat, accuracy: p.accuracy });
      },
      (err) => {
        setError(err);
        onErrorRef.current?.(err);
      },
    );
  }, [active, visible, loc]);

  /** Beim Ausschalten aufrufen (Ereignis-Handler), damit kein alter Standort stehen bleibt. */
  const reset = useCallback(() => {
    setFix(undefined);
    setError(undefined);
  }, []);

  return {
    fix: active ? fix : undefined,
    error: active ? (loc.supported ? error : 'unsupported') : undefined,
    reset,
  } as { fix: GeoFix | undefined; error: GeoError | undefined; reset: () => void };
}
