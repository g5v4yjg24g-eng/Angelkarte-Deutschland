import { describe, expect, it } from 'vitest';
import type { DaySummary, ForecastHour } from './forecast';
import { dayOutlook, levelOf, pressureReason, windReason } from './fishingOutlook';

const DAY = Date.UTC(2026, 10, 10, -1); // Mitternacht Berlin
const H = 3_600_000;

function day(hour: (i: number) => Partial<ForecastHour>, extra: Partial<DaySummary['day']> = {}): DaySummary {
  const hours: ForecastHour[] = Array.from({ length: 24 }, (_, i) => ({ t: DAY + i * H, ...hour(i) }));
  const p = hours.map((h) => h.pressureHpa).filter((x): x is number => x !== undefined);
  const w = hours.map((h) => h.windMs).filter((x): x is number => x !== undefined);
  const g = hours.map((h) => h.gustMs).filter((x): x is number => x !== undefined);
  return {
    t: DAY,
    day: { t: DAY, sunrise: DAY + 7.5 * H, sunset: DAY + 16.5 * H, tMin: 4, tMax: 11, ...extra },
    hours,
    windMaxMs: w.length ? Math.max(...w) : undefined,
    gustMaxMs: g.length ? Math.max(...g) : undefined,
    pressureDelta: p.length >= 2 ? (p.at(-1) ?? 0) - (p[0] ?? 0) : undefined,
  };
}

describe('Regeln einzeln', () => {
  it('Luftdruck: leicht fallend gut, stark fallend neutral, deutlich steigend schlecht', () => {
    expect(pressureReason(-2)).toMatchObject({ effect: 1, kind: 'fallingSlightly' });
    expect(pressureReason(-1)).toMatchObject({ effect: 1 });
    expect(pressureReason(-4)).toMatchObject({ effect: 1 });
    expect(pressureReason(-6)).toMatchObject({ effect: 0, kind: 'fallingStrongly' });
    expect(pressureReason(0.4)).toMatchObject({ effect: 0, kind: 'steady' });
    expect(pressureReason(2)).toMatchObject({ effect: 0, kind: 'risingSlightly' });
    expect(pressureReason(3.5)).toMatchObject({ effect: -1, kind: 'rising' });
  });
  it('Wind: 2–7 m/s gut, Sturm oder Böen > 15 schlecht', () => {
    expect(windReason(4, 6, 9)).toMatchObject({ effect: 1, kind: 'moderate' });
    expect(windReason(1, 2, 3)).toMatchObject({ effect: 0, kind: 'calm' });
    expect(windReason(8, 9, 12)).toMatchObject({ effect: 0, kind: 'fresh' });
    expect(windReason(6, 11, 14)).toMatchObject({ effect: -1, kind: 'strong' });
    expect(windReason(5, 8, 16)).toMatchObject({ effect: -1, kind: 'strong' });
  });
  it('Einordnung: ab 2 günstig, ab −2 schwierig', () => {
    expect([3, 2, 1, 0, -1, -2, -3].map(levelOf)).toEqual([
      'good',
      'good',
      'medium',
      'medium',
      'medium',
      'hard',
      'hard',
    ]);
  });
});

describe('dayOutlook', () => {
  it('Herbsttag mit fallendem Druck, mäßigem Wind und Wolken = günstig, mit Gründen', () => {
    const o = dayOutlook(
      day((i) => ({ pressureHpa: 1015 - i * 0.1, windMs: 4, cloudPct: 85, precipMm: 0, code: 3 })),
    );
    expect(o.level).toBe('good');
    expect(o.score).toBe(3);
    expect(o.reasons.map((r) => `${r.factor}:${r.kind}`)).toEqual([
      'pressure:fallingSlightly',
      'wind:moderate',
      'cloud:overcast',
      'rain:dry',
      'temp:normal',
    ]);
    expect(o.twilight).toHaveLength(2);
    expect(o.safety).toEqual({ thunder: false, storm: false });
  });
  it('Gewitter, Sturm und steigender Druck = schwierig, mit Sicherheitshinweis', () => {
    const o = dayOutlook(
      day((i) => ({
        pressureHpa: 1000 + i * 0.3,
        windMs: 12,
        gustMs: 20,
        cloudPct: 40,
        precipMm: i === 15 ? 6 : 0,
        code: i === 15 ? 95 : 2,
      })),
    );
    expect(o.level).toBe('hard');
    expect(o.safety).toEqual({ thunder: true, storm: true });
  });
  it('Frost oder Hitze kosten einen Punkt', () => {
    const base = () => ({ pressureHpa: 1015, windMs: 4, cloudPct: 20, precipMm: 0 });
    expect(dayOutlook(day(base, { tMin: -3 })).reasons.at(-1)).toMatchObject({ kind: 'frost', effect: -1 });
    expect(dayOutlook(day(base, { tMin: 18, tMax: 31 })).reasons.at(-1)).toMatchObject({
      kind: 'heat',
      effect: -1,
    });
  });
  it('ohne Luftdruck oder Wind keine Bewertung – „unknown“ statt erfundener Einordnung', () => {
    expect(dayOutlook(day(() => ({ windMs: 4 }))).level).toBe('unknown');
    expect(dayOutlook(day(() => ({ pressureHpa: 1010 }))).level).toBe('unknown');
    expect(dayOutlook(day(() => ({}))).reasons).toEqual([]);
  });
  it('fehlende Bewölkung/Regen/Temperatur werden nicht mitgezählt', () => {
    const o = dayOutlook(
      day((i) => ({ pressureHpa: 1015 - i * 0.1, windMs: 4 }), { tMin: undefined, tMax: undefined }),
    );
    expect(o.reasons.map((r) => r.factor)).toEqual(['pressure', 'wind']);
    expect(o.level).toBe('good');
  });
});
