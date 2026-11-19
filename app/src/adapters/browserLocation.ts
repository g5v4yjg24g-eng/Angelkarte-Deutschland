// Standort über die Browser-Funktion `navigator.geolocation` (PWA und Entwicklung).
import type { LocationError, LocationFix, LocationOptions, LocationProvider } from '../ports/location';

const fixOf = (p: GeolocationPosition): LocationFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  t: p.timestamp,
});
const errorOf = (e: GeolocationPositionError): LocationError =>
  e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable';
const optionsOf = (o: LocationOptions): PositionOptions => ({
  enableHighAccuracy: o.highAccuracy,
  ...(o.maxAgeMs !== undefined ? { maximumAge: o.maxAgeMs } : {}),
  ...(o.timeoutMs !== undefined ? { timeout: o.timeoutMs } : {}),
});

export function browserLocation(): LocationProvider {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  return {
    supported,
    permission: async () => {
      try {
        const p = await navigator.permissions?.query({ name: 'geolocation' });
        return p?.state ?? 'unknown';
      } catch {
        return 'unknown';
      }
    },
    watch: (opts, onFix, onError) => {
      if (!supported) return () => undefined;
      const id = navigator.geolocation.watchPosition(
        (p) => onFix(fixOf(p)),
        (e) => onError(errorOf(e)),
        optionsOf(opts),
      );
      return () => navigator.geolocation.clearWatch(id);
    },
    current: (opts) =>
      new Promise<LocationFix>((resolve, reject) => {
        if (!supported) return reject('unavailable' satisfies LocationError);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(fixOf(p)),
          (e) => reject(errorOf(e)),
          optionsOf(opts),
        );
      }),
  };
}
