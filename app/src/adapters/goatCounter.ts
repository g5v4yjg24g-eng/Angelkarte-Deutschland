// GoatCounter (goatcounter.com): keine Cookies, keine Kennung; IP und Browserkennung werden laut Anbieter nur im
// Arbeitsspeicher für 8 h zur Sitzungsbildung genutzt und nie gespeichert [V: goatcounter.com/help/sessions,
// 2026-10-24]. Zählpixel-Endpunkt /count mit Parameter p (Pfad) [V: goatcounter.com/help/pixel, 2026-10-24].
// Gesendet wird nur p – kein Titel, kein Referrer, keine Bildschirmgröße.
import { validCounterCode } from '../domain/usage';
import type { UsageCounter } from '../ports/usage';

export const goatCounterUrl = (code: string, path: string) =>
  `https://${code}.goatcounter.com/count?p=${encodeURIComponent(path)}&rnd=${Math.random().toString(36).slice(2, 8)}`;

export function goatCounter(code: string | undefined): UsageCounter {
  const ok = validCounterCode(code);
  return {
    id: 'goatcounter',
    enabled: ok,
    pageview(path) {
      if (!ok) return;
      void fetch(goatCounterUrl(code, path), {
        mode: 'no-cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}
