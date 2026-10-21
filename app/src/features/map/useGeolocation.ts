import { useCallback, useEffect, useState } from 'react';

export interface GeoFix {
  lng: number;
  lat: number;
  accuracy: number;
}
export type GeoError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

/**
 * Standort nur, solange `active` und die Seite sichtbar ist (kein Hintergrund-Tracking, ARCHITECTURE §5.4).
 * Der Standort verlässt das Gerät nicht.
 */
export function useGeolocation(active: boolean) {
  const [fix, setFix] = useState<GeoFix>();
  const [error, setError] = useState<GeoError>();
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    if (!active || !visible || !supported) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(undefined);
        setFix({ lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy });
      },
      (e) =>
        setError(
          e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable',
        ),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, visible]);

  /** Beim Ausschalten aufrufen (Ereignis-Handler), damit kein alter Standort stehen bleibt. */
  const reset = useCallback(() => {
    setFix(undefined);
    setError(undefined);
  }, []);

  return {
    fix: active ? fix : undefined,
    error: active ? (supported ? error : 'unsupported') : undefined,
    reset,
  } as { fix: GeoFix | undefined; error: GeoError | undefined; reset: () => void };
}
