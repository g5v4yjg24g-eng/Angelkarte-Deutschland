// Landespegel NRW aus OpenHygon (LANUK) über OpenGeoData.NRW: Lizenz DL-DE->Zero-2.0, CORS „*“, Messwerte der
// letzten 7 Tage als ZIP (≈ 0,9 MB), einmal täglich gegen 3 Uhr erzeugt [V: Abruf 2026-10-23]. Freigabe Nutzer
// 2026-10-23 (Variante B1). Entpacken mit fflate (schon für Sicherungen im Projekt).
import { strFromU8, unzipSync } from 'fflate';
import { parseHygonStations, summarizeHygon } from '../domain/gauges';
import type { NrwGaugesProvider } from '../ports/gauges';

export const HYGON_URL =
  'https://www.opengeodata.nrw.de/produkte/umwelt_klima/wasser/oberflaechengewaesser/hygon';
const init: RequestInit = { credentials: 'omit', referrerPolicy: 'no-referrer' };

export const hygonStationsUrl = (base = HYGON_URL) => `${base}/OpenHygon-Pegel-Stationen_EPSG4326.txt`;
export const hygonValuesUrl = (base = HYGON_URL) => `${base}/OpenHygon-Pegel-aktuell_CSV.zip`;

export function hygonNrw(base = HYGON_URL): NrwGaugesProvider {
  return {
    id: 'hygon-nrw',
    async stations() {
      const [s, v] = await Promise.all([
        fetch(hygonStationsUrl(base), init),
        fetch(hygonValuesUrl(base), init),
      ]);
      if (!s.ok || !v.ok) throw new Error(`Landespegel: HTTP ${s.status}/${v.status}`);
      const stations = parseHygonStations(await s.text());
      const files = unzipSync(new Uint8Array(await v.arrayBuffer()));
      const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.txt'));
      const data = name ? files[name] : undefined;
      if (!stations.length || !data) return null;
      return summarizeHygon(stations, strFromU8(data));
    },
  };
}
