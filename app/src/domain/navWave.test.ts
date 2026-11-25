import { describe, expect, it } from 'vitest';
import {
  WAVE_INSET,
  approach,
  baseY,
  bump,
  halfBaseFor,
  waveFill,
  wavePath,
  wavePoints,
  waveRange,
  waveY,
} from './navWave';

const G = { width: 366, height: 64, center: 183, halfBase: 42 };

describe('bump', () => {
  it('ist am Scheitel 1, am Fuß 0 und dazwischen stetig fallend', () => {
    expect(bump(0, 40)).toBe(1);
    expect(bump(4, 40)).toBe(1);
    expect(bump(40, 40)).toBe(0);
    expect(bump(-60, 40)).toBe(0);
    let last = 1;
    for (let d = 4; d <= 40; d += 1) {
      const v = bump(d, 40);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });
});

describe('Kontur', () => {
  it('verläuft unten gerade und biegt an den Enden nach oben', () => {
    expect(baseY(183, 366, 64)).toBe(64 - WAVE_INSET);
    expect(baseY(32, 366, 64)).toBe(64 - WAVE_INSET);
    expect(baseY(5, 366, 64)).toBeLessThan(baseY(32, 366, 64));
    expect(baseY(361, 366, 64)).toBeLessThan(baseY(334, 366, 64));
  });
});

describe('Linie', () => {
  it('liegt außerhalb des Hügels auf der Kontur', () => {
    expect(waveY(60, G)).toBeCloseTo(baseY(60, G.width, G.height), 5);
    expect(waveY(300, G)).toBeCloseTo(baseY(300, G.width, G.height), 5);
  });
  it('steigt am Scheitel nahe an den oberen Rand, bleibt aber in der Kapsel', () => {
    const top = waveY(G.center, G);
    expect(top).toBeGreaterThan(WAVE_INSET);
    expect(top).toBeLessThan(12);
    for (const [, y] of wavePoints(G)) {
      expect(y).toBeGreaterThanOrEqual(WAVE_INSET);
      expect(y).toBeLessThanOrEqual(G.height - WAVE_INSET);
    }
  });
  it('ohne Hügel (Mitte außerhalb) ist sie flach auf der Kontur', () => {
    const flat = { ...G, center: -9999 };
    for (const [x, y] of wavePoints(flat)) expect(y).toBeCloseTo(baseY(x, G.width, G.height), 5);
  });
  it('beginnt und endet auf den Bögen der Kapselenden, symmetrisch', () => {
    const [from, to] = waveRange(366, 64);
    expect(from).toBeGreaterThan(0);
    expect(from).toBeLessThan(32);
    expect(366 - to).toBeCloseTo(from, 5);
    const pts = wavePoints(G);
    expect(pts[0]?.[0]).toBeCloseTo(from, 5);
    expect(pts[pts.length - 1]?.[0]).toBeCloseTo(to, 5);
  });
  it('liefert einen gültigen Pfad; die Füllung gibt es nur bei sichtbarem Hügel', () => {
    expect(wavePath(G)).toMatch(/^M[\d. ]+(L[\d. -]+)+$/);
    expect(waveFill(G)).toMatch(/Z$/);
    expect(waveFill({ ...G, center: -9999 })).toBe('');
  });
  it('Hügel am äußersten linken Punkt bleibt in der Kapsel', () => {
    const left = { ...G, center: 31 };
    for (const [x, y] of wavePoints(left)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(WAVE_INSET);
    }
  });
});

describe('approach / halfBaseFor', () => {
  it('nähert sich dem Ziel und erreicht es', () => {
    let x = 0;
    for (let i = 0; i < 200; i++) x = approach(x, 100, 16);
    expect(x).toBe(100);
    expect(approach(0, 100, 16)).toBeGreaterThan(0);
    expect(approach(0, 100, 16)).toBeLessThan(100);
    expect(approach(50, 50, 16)).toBe(50);
  });
  it('begrenzt die Fußbreite', () => {
    expect(halfBaseFor(10)).toBe(30);
    expect(halfBaseFor(58)).toBeCloseTo(41.76, 5);
    expect(halfBaseFor(400)).toBe(56);
  });
});
