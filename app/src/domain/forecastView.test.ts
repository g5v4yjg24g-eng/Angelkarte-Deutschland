import { describe, expect, it } from 'vitest';
import type { Forecast } from './forecast';
import { moonEvents, solunarWindows } from './solunar';
import {
  barSpan,
  dayDetail,
  daySpan,
  hourStrip,
  isNight,
  niceTicks,
  pct,
  solunarDay,
  tempBounds,
  tempColor,
  weatherIcon,
} from './forecastView';

const H = 3_600_000;
const day0 = Date.UTC(2026, 9, 27, 23); // 28.10. 00:00 Berlin (Winterzeit)
const f: Forecast = {
  fetchedAt: day0,
  lat: 51.3,
  lng: 6.2,
  hours: Array.from({ length: 48 }, (_, i) => ({
    t: day0 + i * H,
    tempC: 7 + Math.round(7 * Math.sin(((i % 24) - 8) / 4)),
    code: i % 24 < 12 || i % 24 >= 18 ? 1 : 3,
    precipProb: i === 30 ? 45 : 0,
  })),
  days: [
    { t: day0, sunrise: day0 + 7.5 * H, sunset: day0 + 17.25 * H, tMin: 7, tMax: 14, code: 2 },
    {
      t: day0 + 24 * H,
      sunrise: day0 + 31.5 * H,
      sunset: day0 + 41.25 * H,
      tMin: 8,
      tMax: 16,
      precipProbMax: 45,
    },
  ],
};

describe('Wetter-Ansicht (WX-V1)', () => {
  it('Symbole aus dem Wettercode, nachts Mond', () => {
    expect(weatherIcon(0)).toBe('clear');
    expect(weatherIcon(0, true)).toBe('clearNight');
    expect(weatherIcon(2, true)).toBe('partlyNight');
    expect(weatherIcon(3)).toBe('cloudy');
    expect(weatherIcon(45)).toBe('fog');
    expect(weatherIcon(53)).toBe('drizzle');
    expect(weatherIcon(63)).toBe('rain');
    expect(weatherIcon(67)).toBe('sleet');
    expect(weatherIcon(75)).toBe('snow');
    expect(weatherIcon(81)).toBe('showers');
    expect(weatherIcon(95)).toBe('thunder');
    expect(weatherIcon(undefined)).toBe('cloudy');
  });

  it('Nacht vor Sonnenaufgang und ab Sonnenuntergang', () => {
    expect(isNight(f, day0 + 5 * H)).toBe(true);
    expect(isNight(f, day0 + 12 * H)).toBe(false);
    expect(isNight(f, day0 + 18 * H)).toBe(true);
  });

  it('Stundenleiste: ab der laufenden Stunde („Jetzt“), Sonnenuntergang eingereiht', () => {
    const now = day0 + 15.5 * H;
    const s = hourStrip(f, now, 5);
    expect(s.map((x) => x.kind)).toEqual(['hour', 'hour', 'hour', 'sunset', 'hour', 'hour']);
    expect(s[0]).toMatchObject({ kind: 'hour', now: true, t: day0 + 15 * H });
    expect(s[3]?.t).toBe(day0 + 17.25 * H);
    // nach Sonnenuntergang: Mond
    expect(s[4]).toMatchObject({ icon: 'partlyNight' });
  });

  it('Temperaturbalken: gemeinsame Spanne, Lage und Breite in %', () => {
    const b = tempBounds(f.days) ?? { min: 0, max: 1 };
    expect(b).toEqual({ min: 7, max: 16 });
    expect(barSpan(8, 16, b)).toEqual({ left: (1 / 9) * 100, width: (8 / 9) * 100 });
    expect(pct(30, b)).toBe(100);
    expect(tempBounds([{}])).toBeUndefined();
  });

  it('Farbe nach Temperatur: kalt blau, warm rot', () => {
    expect(tempColor(-5)).toBe('#4fb3e8');
    expect(tempColor(14)).toBe('#a8d672');
    expect(tempColor(40)).toBe('#eb5757');
  });

  it('Tagesdetail: 24 Stunden, Hoch und Tief mit Uhrzeit, Regenwahrscheinlichkeit', () => {
    const d = dayDetail(f, day0 + 24 * H);
    expect(d.hours).toHaveLength(24);
    expect(d.hi?.v).toBeGreaterThan(d.lo?.v ?? 99);
    expect(d.precipProbMax).toBe(45);
    expect(dayDetail(f, day0).precipProbMax).toBe(0);
  });

  it('Achsenteilung mit runden Schritten', () => {
    expect(niceTicks(7, 14)).toEqual([6, 8, 10, 12, 14]);
    expect(niceTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('Solunar-Zeiten des Tages am Ort der Vorhersage, Fenster auf der Tagesleiste abgeschnitten', () => {
    const s = solunarDay(f, day0);
    expect(s.windows).toEqual(solunarWindows(moonEvents(day0, day0 + 24 * H, 51.3, 6.2)));
    expect(s.windows.every((w) => w.center >= day0 && w.center < day0 + 24 * H)).toBe(true);
    expect(s.phase.fraction).toBeGreaterThanOrEqual(0);
    expect(s.phase.fraction).toBeLessThanOrEqual(1);
    expect(daySpan(day0 + 6 * H, day0 + 12 * H, day0, day0 + 24 * H)).toEqual({ left: 25, width: 25 });
    const cut = daySpan(day0 - H, day0 + H, day0, day0 + 24 * H);
    expect(cut.left).toBe(0);
    expect(cut.width).toBeCloseTo(100 / 24);
  });
});
