import { describe, expect, it } from 'vitest';
import { endAngle, lineCurve, rodAngleAt, rodTip, type AnglerSpec } from './angler';

const a: AnglerSpec = { hand: [380, 40], length: 60, base: 30 };

describe('Angler und Rute (RET-4)', () => {
  it('Winkel zwischen den Stützstellen, vor und nach den Stützstellen der Rand, ohne Bewegung der Ruhewinkel', () => {
    const lift = {
      keys: [
        [0, 30],
        [0.5, 60],
        [1, 60],
      ] as const,
    };
    expect(rodAngleAt(lift, 0, 0)).toBe(30);
    expect(rodAngleAt(lift, 0.25, 0)).toBe(45);
    expect(rodAngleAt(lift, 2, 0)).toBe(60);
    expect(rodAngleAt(undefined, 0.5, 30)).toBe(30);
    expect(endAngle(lift, 0)).toBe(60);
  });

  it('Rutenspitze: waagerecht links, senkrecht oben, über 90° zum Angler hin', () => {
    const [x0, y0] = rodTip(a, 0);
    expect([Math.round(x0), Math.round(y0)]).toEqual([320, 40]);
    const [x1, y1] = rodTip(a, 90);
    expect([Math.round(x1), Math.round(y1)]).toEqual([380, -20]);
    expect(rodTip(a, 120)[0]).toBeGreaterThan(380);
  });

  it('Schnur hängt locker stärker durch', () => {
    expect(lineCurve([0, 0], [100, 100])).toBe('M0 0 Q50 56 100 100');
    expect(lineCurve([0, 0], [100, 100], true)).toBe('M0 0 Q50 78 100 100');
  });
});
