// PEGELONLINE (WSV), REST-API v2: frei nutzbar, Lizenz DL-DE->Zero-2.0, ungeprüfte Rohdaten
// [V: pegelonline.wsv.de/webservice/ueberblick, 2026-10-23]; CORS „*“ [V: Abruf 2026-10-23].
import { parseMeasurements, parsePegelonlineStations } from '../domain/gauges';
import type { GaugesProvider } from '../ports/gauges';

export const PEGELONLINE_URL = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2';
const init: RequestInit = { credentials: 'omit', referrerPolicy: 'no-referrer' };

export const pegelonlineStationsUrl = (base = PEGELONLINE_URL) =>
  `${base}/stations.json?includeTimeseries=true&includeCurrentMeasurement=true`;
export const pegelonlineLevelUrl = (uuid: string, base = PEGELONLINE_URL) =>
  `${base}/stations/${encodeURIComponent(uuid)}/W/measurements.json?start=P1D`;

export function pegelonline(base = PEGELONLINE_URL): GaugesProvider {
  return {
    id: 'pegelonline',
    async stations() {
      const r = await fetch(pegelonlineStationsUrl(base), init);
      if (!r.ok) throw new Error(`Pegel: HTTP ${r.status}`);
      return parsePegelonlineStations(await r.json());
    },
    async waterLevel24h(uuid) {
      const r = await fetch(pegelonlineLevelUrl(uuid, base), init);
      if (!r.ok) throw new Error(`Pegel: HTTP ${r.status}`);
      return parseMeasurements(await r.json());
    },
  };
}
