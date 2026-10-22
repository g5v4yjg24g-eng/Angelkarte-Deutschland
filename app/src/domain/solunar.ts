// Solunar-Zeiten (Wunsch Nutzer 2026-10-22): Mondauf-/-untergang, Mond oben/unten und Mondphase, offline berechnet.
// Näherungsformeln für Mond- und Sonnenposition (Meeus, „Astronomical Algorithms", in der verbreiteten Kurzform von
// aa.quae.nl/en/reken/hemelpositie.html). Abweichung zu den Werten des U.S. Naval Observatory im Test: wenige Minuten.
// Die Solunar-Theorie selbst (J. A. Knight) ist wissenschaftlich nicht belegt – die App sagt das dazu.

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;
/** Höhe des Mondmittelpunkts bei Auf-/Untergang: Parallaxe ≈ +0,95°, Refraktion −0,57°, Halbmesser −0,26° */
const MOON_H0 = RAD * 0.125;
const SCAN_MS = 2 * 60_000;

const toDays = (ms: number) => ms / DAY_MS + 2440587.5 - J2000;

function equatorial(l: number, b: number) {
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)),
  };
}

function moonCoords(d: number) {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  return { ...equatorial(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

function sunCoords(d: number) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const l = M + C + RAD * 102.9372 + Math.PI;
  return { ...equatorial(l, 0), dist: 149598000 };
}

/** Höhe (rad) und Stundenwinkel (rad, −π…π) des Mondes. */
export function moonPosition(ms: number, lat: number, lng: number): { alt: number; hourAngle: number } {
  const d = toDays(ms);
  const c = moonCoords(d);
  const phi = RAD * lat;
  const theta = RAD * (280.16 + 360.9856235 * d) + RAD * lng;
  let H = (theta - c.ra) % (2 * Math.PI);
  if (H > Math.PI) H -= 2 * Math.PI;
  if (H < -Math.PI) H += 2 * Math.PI;
  const alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  return { alt, hourAngle: H };
}

export interface MoonEvents {
  rise?: number;
  set?: number;
  /** Mond oben (Kulmination) */
  upper?: number;
  /** Mond unten (untere Kulmination) */
  lower?: number;
}

/** Ereignisse im Zeitraum [from, to) – je Art das erste; fehlt eins, gibt es an diesem Tag keins (z. B. kein Mondaufgang). */
export function moonEvents(from: number, to: number, lat: number, lng: number): MoonEvents {
  const out: MoonEvents = {};
  let prev = moonPosition(from, lat, lng);
  for (let t = from + SCAN_MS; t <= to; t += SCAN_MS) {
    const cur = moonPosition(t, lat, lng);
    const at = (a: number, b: number) => t - SCAN_MS + (SCAN_MS * a) / (a - b); // linear zwischen den Stützstellen
    const ea = prev.alt - MOON_H0;
    const eb = cur.alt - MOON_H0;
    if (ea < 0 && eb >= 0) out.rise ??= at(ea, eb);
    if (ea >= 0 && eb < 0) out.set ??= at(ea, eb);
    // Stundenwinkel springt bei ±π (untere Kulmination); Nulldurchgang von − nach + ist die obere
    if (prev.hourAngle < 0 && cur.hourAngle >= 0) out.upper ??= at(prev.hourAngle, cur.hourAngle);
    if (prev.hourAngle > Math.PI / 2 && cur.hourAngle < -Math.PI / 2) {
      const a = prev.hourAngle - Math.PI;
      const b = cur.hourAngle + Math.PI;
      out.lower ??= at(a, b);
    }
    prev = cur;
  }
  return out;
}

export interface MoonPhase {
  /** beleuchteter Anteil 0…1 */
  fraction: number;
  /** 0 Neumond, 0,25 erstes Viertel, 0,5 Vollmond, 0,75 letztes Viertel */
  phase: number;
}

export function moonPhase(ms: number): MoonPhase {
  const d = toDays(ms);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
  );
  const inc = Math.atan2(s.dist * Math.sin(phi), m.dist - s.dist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI };
}

export type PhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

/** Phasenname; „Viertel", Neu- und Vollmond gelten ±0,03 um den genauen Wert. */
export function phaseName(phase: number): PhaseName {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return 'new';
  if (Math.abs(p - 0.25) < 0.03) return 'firstQuarter';
  if (Math.abs(p - 0.5) < 0.03) return 'full';
  if (Math.abs(p - 0.75) < 0.03) return 'lastQuarter';
  if (p < 0.25) return 'waxingCrescent';
  if (p < 0.5) return 'waxingGibbous';
  if (p < 0.75) return 'waningGibbous';
  return 'waningCrescent';
}

export interface SolunarWindow {
  kind: 'major' | 'minor';
  /** Anlass: Mond oben/unten (Hauptzeit) bzw. Mondauf-/-untergang (Nebenzeit) */
  event: keyof MoonEvents;
  center: number;
  from: number;
  to: number;
}

/** Solunar-Konvention nach J. A. Knight [A]: Hauptzeiten ±60 min um Mond oben/unten, Nebenzeiten ±30 min um Auf-/Untergang. */
export const MAJOR_HALF_MS = 60 * 60_000;
export const MINOR_HALF_MS = 30 * 60_000;

export function solunarWindows(events: MoonEvents): SolunarWindow[] {
  const out: SolunarWindow[] = [];
  for (const event of ['upper', 'lower', 'rise', 'set'] as const) {
    const c = events[event];
    if (c === undefined) continue;
    const kind = event === 'upper' || event === 'lower' ? 'major' : 'minor';
    const half = kind === 'major' ? MAJOR_HALF_MS : MINOR_HALF_MS;
    out.push({ kind, event, center: c, from: c - half, to: c + half });
  }
  return out.sort((a, b) => a.from - b.from);
}
