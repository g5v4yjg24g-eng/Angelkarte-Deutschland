import { describe, expect, it } from 'vitest';
import {
  ARRIVE_MS,
  isDoubleTap,
  isTap,
  PIKE_BOTTOM,
  PIKE_SPOTS,
  PIKE_TOP,
  pikeSize,
  profileAt,
  swimPath,
  swimPose,
  TOTAL_MS,
} from './pikeSwim';

describe('Form', () => {
  it('Körper ist hinten schmal, in der Mitte am höchsten, Schnauze flach', () => {
    expect(profileAt(PIKE_TOP, 52)).toBeCloseTo(9.6);
    expect(profileAt(PIKE_TOP, 5)).toBe(3);
    expect(profileAt(PIKE_BOTTOM, 120)).toBe(1.5);
    expect(profileAt(PIKE_TOP, 98)).toBeLessThan(profileAt(PIKE_TOP, 80));
  });
  it('Flecken liegen auf der Flanke, nicht am Kopf oder Schwanz – und sind bei jedem Laden gleich', () => {
    expect(PIKE_SPOTS.length).toBeGreaterThan(40);
    for (const [x, rel] of PIKE_SPOTS) {
      expect(x).toBeGreaterThan(18);
      expect(x).toBeLessThan(81);
      expect(Math.abs(rel)).toBeLessThan(0.9);
    }
  });
});

describe('Bahn', () => {
  const W = 360;
  const H = 450;
  const size = pikeSize(W);

  it('Größe folgt der Bildbreite, mit Grenzen', () => {
    expect(size).toBe(97);
    expect(pikeSize(100)).toBe(64);
    expect(pikeSize(2000)).toBe(120);
  });

  it('bleibt im Bild – auch bei Tipp am Rand und Daumen außerhalb (beim Abtauchen schneidet der Rand ab)', () => {
    const p = swimPath({ x: -20, y: 2 }, -50, W, H, size);
    for (let ms = 0; ms <= ARRIVE_MS; ms += 25) {
      const pose = swimPose(p, ms);
      expect(pose.x).toBeGreaterThanOrEqual(0);
      expect(pose.x).toBeLessThanOrEqual(W);
      expect(pose.y).toBeGreaterThanOrEqual(0);
      expect(pose.y).toBeLessThanOrEqual(H);
    }
  });

  it('endet am unteren Rand über dem Daumen und taucht senkrecht nach unten ab', () => {
    const p = swimPath({ x: 250, y: 120 }, 60, W, H, size);
    const arrive = swimPose(p, ARRIVE_MS);
    expect(arrive.x).toBeCloseTo(60);
    expect(arrive.y).toBeGreaterThan(H * 0.9);
    expect(Math.cos(arrive.heading)).toBeCloseTo(0, 0);
    expect(Math.sin(arrive.heading)).toBeGreaterThan(0.9);
  });

  it('Ablauf: auftauchen, schwimmen, ausblenden, fertig', () => {
    const p = swimPath({ x: 250, y: 120 }, 60, W, H, size);
    expect(swimPose(p, 0).alpha).toBe(0);
    expect(swimPose(p, 100).scale).toBeLessThan(1);
    expect(swimPose(p, 600).alpha).toBe(1);
    expect(swimPose(p, TOTAL_MS - 1).done).toBe(false);
    const end = swimPose(p, TOTAL_MS);
    expect(end.done).toBe(true);
    expect(end.alpha).toBe(0);
  });
});

describe('Doppeltipp', () => {
  it('nur kurze, ruhige Tipps zählen – Wischen nicht', () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 5, y: 5, t: 120 })).toBe(true);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 120 })).toBe(false);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 900 })).toBe(false);
  });
  it('zwei Tipps binnen 300 ms nah beieinander', () => {
    const a = { x: 100, y: 100, t: 1000 };
    expect(isDoubleTap(undefined, a)).toBe(false);
    expect(isDoubleTap(a, { x: 110, y: 104, t: 1200 })).toBe(true);
    expect(isDoubleTap(a, { x: 110, y: 104, t: 1400 })).toBe(false);
    expect(isDoubleTap(a, { x: 200, y: 100, t: 1100 })).toBe(false);
  });
});
