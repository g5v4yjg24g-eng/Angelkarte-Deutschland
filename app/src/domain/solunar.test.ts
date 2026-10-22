import { describe, expect, it } from 'vitest';
import { moonEvents, moonPhase, phaseName, solunarWindows } from './solunar';

// Referenz: U.S. Naval Observatory, Astronomical Applications API (rstt/oneday), Ort 51,32° N 6,24° O, Zeiten UTC,
// abgerufen 2026-10-22 [V: aa.usno.navy.mil/api/rstt/oneday]
const REF = [
  { day: '2026-10-22', set: '01:23', rise: '14:56', upper: '20:40', illum: 84 },
  { day: '2026-10-25', set: '05:22', rise: '15:36', upper: '23:02', illum: 99 },
  { day: '2026-11-05', rise: '02:07', upper: '08:20', set: '14:18', illum: 14 },
  { day: '2026-06-21', rise: '11:14', upper: '17:25', set: '23:20', illum: 46 },
] as const;
const TOLERANCE_MIN = 10;
const at = (day: string, hm: string) => Date.parse(`${day}T${hm}:00Z`);

describe('Solunar: Mondzeiten', () => {
  for (const r of REF)
    it(`${r.day}: Auf-/Untergang und Mond oben ±${TOLERANCE_MIN} min, Beleuchtung ±2 %`, () => {
      const from = Date.parse(`${r.day}T00:00:00Z`);
      const e = moonEvents(from, from + 86_400_000, 51.32, 6.24);
      for (const k of ['rise', 'set', 'upper'] as const) {
        const got = e[k];
        expect(got, k).toBeDefined();
        expect(Math.abs((got ?? 0) - at(r.day, r[k])) / 60_000, k).toBeLessThanOrEqual(TOLERANCE_MIN);
      }
      expect(Math.abs(moonPhase(from + 43_200_000).fraction * 100 - r.illum)).toBeLessThanOrEqual(2);
    });

  it('Phasennamen', () => {
    expect(phaseName(0.01)).toBe('new');
    expect(phaseName(0.24)).toBe('firstQuarter');
    expect(phaseName(0.37)).toBe('waxingGibbous');
    expect(phaseName(0.5)).toBe('full');
    expect(phaseName(0.88)).toBe('waningCrescent');
  });

  it('Fenster: Hauptzeiten ±60 min um Mond oben/unten, Nebenzeiten ±30 min um Auf-/Untergang, zeitlich sortiert', () => {
    const w = solunarWindows({
      rise: 10 * 3_600_000,
      upper: 16 * 3_600_000,
      set: 22 * 3_600_000,
      lower: 4 * 3_600_000,
    });
    expect(w.map((x) => [x.kind, x.event, (x.to - x.from) / 60_000])).toEqual([
      ['major', 'lower', 120],
      ['minor', 'rise', 60],
      ['major', 'upper', 120],
      ['minor', 'set', 60],
    ]);
  });
});
