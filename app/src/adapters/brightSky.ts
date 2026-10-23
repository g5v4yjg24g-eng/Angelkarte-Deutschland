// Amtliche Warnungen des DWD über Bright Sky (kostenlos, ohne Schlüssel, CORS erlaubt
// [V: Abruf 2026-10-22, access-control-allow-origin: *]). Freigabe Nutzer 2026-10-23.
import { parseBrightSkyAlerts, type AlertsQuery } from '../domain/alerts';
import type { AlertsProvider } from '../ports/alerts';

export const BRIGHT_SKY_ALERTS_URL = 'https://api.brightsky.dev/alerts';

export function brightSkyAlertsUrl(q: AlertsQuery, base = BRIGHT_SKY_ALERTS_URL): string {
  const u = new URL(base);
  u.search = new URLSearchParams({
    lat: q.lat.toFixed(3),
    lon: q.lng.toFixed(3),
    tz: 'Europe/Berlin',
  }).toString();
  return u.toString();
}

export function brightSkyAlerts(base = BRIGHT_SKY_ALERTS_URL): AlertsProvider {
  return {
    id: 'bright-sky',
    async alerts(q) {
      const r = await fetch(brightSkyAlertsUrl(q, base), {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!r.ok) throw new Error(`Warnungen: HTTP ${r.status}`);
      return parseBrightSkyAlerts(await r.json(), q, Date.now());
    },
  };
}
