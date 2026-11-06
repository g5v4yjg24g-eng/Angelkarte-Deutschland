// Beißprognose (Paket 5, Regeln vom Nutzer freigegeben 2026-11-06): einfache Einordnung je Tag aus der
// Wettervorhersage. Rein, ohne DOM. Faustregeln aus der Anglerpraxis [A] – keine Messung, keine Fanggarantie.
// Keine Wassertemperatur, kein Mond (gibt es in den Daten nicht). Persönliche Beißfenster: domain/biteAnalysis.ts.
import type { DaySummary, ForecastHour } from './forecast';

export type OutlookLevel = 'good' | 'medium' | 'hard' | 'unknown';
export type Effect = 1 | 0 | -1;

export type Reason =
  | {
      factor: 'pressure';
      effect: Effect;
      kind: 'fallingSlightly' | 'fallingStrongly' | 'steady' | 'risingSlightly' | 'rising';
      delta: number;
    }
  | {
      factor: 'wind';
      effect: Effect;
      kind: 'moderate' | 'calm' | 'fresh' | 'strong';
      windMs: number;
      gustMs?: number | undefined;
    }
  | { factor: 'cloud'; effect: Effect; kind: 'overcast' | 'mixed'; cloudPct: number }
  | { factor: 'rain'; effect: Effect; kind: 'dry' | 'light' | 'heavy' | 'thunder'; maxMm: number }
  | {
      factor: 'temp';
      effect: Effect;
      kind: 'frost' | 'heat' | 'normal';
      tMin?: number | undefined;
      tMax?: number | undefined;
    };

export interface Outlook {
  level: OutlookLevel;
  score: number;
  reasons: Reason[];
  /** Sicherheit: Gewitter oder Sturm im Tag */
  safety: { thunder: boolean; storm: boolean };
  /** Dämmerung (je etwa 2 h um Sonnenauf- und -untergang), oft gute Zeit – ändert die Bewertung nicht */
  twilight: { from: number; to: number }[];
}

// Grenzen (freigegebener Vorschlag)
export const PRESSURE = { slightFall: -1, strongFall: -4, rise: 3 } as const;
export const WIND = { min: 2, max: 7, strong: 10, gustStrong: 15 } as const;
export const CLOUD_OVERCAST = 70;
export const RAIN_HEAVY_MM = 4;
export const TEMP = { frost: 0, heat: 28 } as const;
const THUNDER_CODES = new Set([95, 96, 99]);
const TWILIGHT_MS = 60 * 60 * 1000;

const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const nums = (hours: readonly ForecastHour[], k: keyof ForecastHour) =>
  hours.map((h) => h[k]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/** Stunden bei Tageslicht (Sonnenauf- bis -untergang); ohne Sonnenzeiten 6–21 Uhr Ortszeit ≈ Tagesbeginn + 6/21 h */
function daylight(s: DaySummary): ForecastHour[] {
  const from = s.day.sunrise ?? s.t + 6 * 3_600_000;
  const to = s.day.sunset ?? s.t + 21 * 3_600_000;
  const hrs = s.hours.filter((h) => h.t >= from && h.t <= to);
  return hrs.length ? hrs : s.hours;
}

export function pressureReason(delta: number): Reason {
  const d = Math.round(delta * 10) / 10;
  if (d < PRESSURE.strongFall) return { factor: 'pressure', effect: 0, kind: 'fallingStrongly', delta: d };
  if (d <= PRESSURE.slightFall) return { factor: 'pressure', effect: 1, kind: 'fallingSlightly', delta: d };
  if (d > PRESSURE.rise) return { factor: 'pressure', effect: -1, kind: 'rising', delta: d };
  if (d >= 1) return { factor: 'pressure', effect: 0, kind: 'risingSlightly', delta: d };
  return { factor: 'pressure', effect: 0, kind: 'steady', delta: d };
}

export function windReason(typical: number, max: number, gust: number | undefined): Reason {
  const w = Math.round(typical * 10) / 10;
  if (max > WIND.strong || (gust !== undefined && gust > WIND.gustStrong))
    return { factor: 'wind', effect: -1, kind: 'strong', windMs: Math.round(max * 10) / 10, gustMs: gust };
  if (w < WIND.min) return { factor: 'wind', effect: 0, kind: 'calm', windMs: w };
  if (w <= WIND.max) return { factor: 'wind', effect: 1, kind: 'moderate', windMs: w };
  return { factor: 'wind', effect: 0, kind: 'fresh', windMs: w };
}

export const levelOf = (score: number): Exclude<OutlookLevel, 'unknown'> =>
  score >= 2 ? 'good' : score <= -2 ? 'hard' : 'medium';

/** Einschätzung eines Tages; ohne Luftdruck-Verlauf oder Wind „unknown“ (keine erfundene Bewertung) */
export function dayOutlook(s: DaySummary): Outlook {
  const light = daylight(s);
  const codes = nums(s.hours, 'code');
  const thunder = codes.some((c) => THUNDER_CODES.has(c));
  const windAll = nums(s.hours, 'windMs');
  const gust = s.gustMaxMs;
  const storm = (s.windMaxMs ?? 0) > WIND.strong || (gust ?? 0) > WIND.gustStrong;
  const twilight = [s.day.sunrise, s.day.sunset]
    .filter((x): x is number => typeof x === 'number')
    .map((x) => ({ from: x - TWILIGHT_MS, to: x + TWILIGHT_MS }));

  const typicalWind = median(nums(light, 'windMs'));
  const pressureHours = nums(s.hours, 'pressureHpa').length;
  if (s.pressureDelta === undefined || pressureHours < 2 || typicalWind === undefined || !windAll.length)
    return { level: 'unknown', score: 0, reasons: [], safety: { thunder, storm }, twilight };

  const reasons: Reason[] = [
    pressureReason(s.pressureDelta),
    windReason(typicalWind, Math.max(...windAll), gust),
  ];
  const cloud = mean(nums(light, 'cloudPct'));
  if (cloud !== undefined) {
    const c = Math.round(cloud);
    reasons.push(
      c >= CLOUD_OVERCAST
        ? { factor: 'cloud', effect: 1, kind: 'overcast', cloudPct: c }
        : { factor: 'cloud', effect: 0, kind: 'mixed', cloudPct: c },
    );
  }
  const rain = nums(s.hours, 'precipMm');
  if (rain.length || thunder) {
    const maxMm = rain.length ? Math.max(...rain) : 0;
    const sum = rain.reduce((a, b) => a + b, 0);
    reasons.push(
      thunder
        ? { factor: 'rain', effect: -1, kind: 'thunder', maxMm }
        : maxMm > RAIN_HEAVY_MM
          ? { factor: 'rain', effect: -1, kind: 'heavy', maxMm }
          : { factor: 'rain', effect: 0, kind: sum < 0.2 ? 'dry' : 'light', maxMm },
    );
  }
  const { tMin, tMax } = s.day;
  if (tMin !== undefined || tMax !== undefined) {
    reasons.push(
      tMin !== undefined && tMin < TEMP.frost
        ? { factor: 'temp', effect: -1, kind: 'frost', tMin, tMax }
        : tMax !== undefined && tMax > TEMP.heat
          ? { factor: 'temp', effect: -1, kind: 'heat', tMin, tMax }
          : { factor: 'temp', effect: 0, kind: 'normal', tMin, tMax },
    );
  }
  const score = reasons.reduce((a, r) => a + r.effect, 0);
  return { level: levelOf(score), score, reasons, safety: { thunder, storm }, twilight };
}
