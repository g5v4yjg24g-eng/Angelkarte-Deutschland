import { describe, expect, it } from 'vitest';
import { PULL_MAX, PULL_THRESHOLD, canStartPull, isPullReady, pullOffset } from './pullRefresh';

describe('pullRefresh', () => {
  it('kein Zug nach oben oder ohne Bewegung', () => {
    expect(pullOffset(0)).toBe(0);
    expect(pullOffset(-30)).toBe(0);
    expect(pullOffset(Number.NaN)).toBe(0);
  });
  it('wächst, bleibt aber unter dem Höchstwert', () => {
    expect(pullOffset(40)).toBeGreaterThan(pullOffset(20));
    expect(pullOffset(200)).toBeLessThan(PULL_MAX);
    expect(pullOffset(10_000)).toBeLessThanOrEqual(PULL_MAX);
  });
  it('löst nach einem kräftigen Zug aus, nicht nach einem kurzen', () => {
    expect(isPullReady(pullOffset(30))).toBe(false);
    expect(isPullReady(pullOffset(200))).toBe(true);
    expect(isPullReady(PULL_THRESHOLD)).toBe(true);
  });
  it('beginnt nur ganz oben und mit einem Finger', () => {
    expect(canStartPull(0, 1)).toBe(true);
    expect(canStartPull(12, 1)).toBe(false);
    expect(canStartPull(0, 2)).toBe(false);
  });
});
