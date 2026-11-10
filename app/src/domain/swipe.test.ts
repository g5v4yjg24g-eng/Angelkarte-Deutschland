import { describe, expect, it } from 'vitest';
import { swipeAxis, swipeTarget } from './swipe';

describe('Foto-Karussell wischen (FEED-6)', () => {
  it('Richtung erst ab 10 px, waagerecht nur bei deutlicher Seitwärtsbewegung', () => {
    expect(swipeAxis(5, 3)).toBeUndefined();
    expect(swipeAxis(30, 5)).toBe('x');
    expect(swipeAxis(-30, 10)).toBe('x');
    // schräg beim Scrollen: bleibt senkrecht, Fotos bewegen sich nicht
    expect(swipeAxis(20, 15)).toBe('y');
    expect(swipeAxis(12, -40)).toBe('y');
  });

  it('Ziel-Foto: weit genug oder schnell genug, nie über den Rand', () => {
    expect(swipeTarget(0, 3, -100, 390, 400)).toBe(1);
    expect(swipeTarget(1, 3, 100, 390, 400)).toBe(0);
    expect(swipeTarget(0, 3, -40, 390, 400)).toBe(0);
    expect(swipeTarget(0, 3, -40, 390, 80)).toBe(1);
    expect(swipeTarget(2, 3, -200, 390, 200)).toBe(2);
    expect(swipeTarget(0, 3, 200, 390, 200)).toBe(0);
    expect(swipeTarget(0, 1, -200, 390, 200)).toBe(0);
  });
});
