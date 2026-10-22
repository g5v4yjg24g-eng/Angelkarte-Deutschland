import { describe, expect, it } from 'vitest';
import { itemAt, lensCenter } from './navLens';

const items = [0, 70, 140, 210, 280].map((left) => ({ left, width: 68 }));

describe('Glas-Linse der Leiste', () => {
  it('findet den Punkt unter dem Finger, auch in Lücken und außerhalb', () => {
    expect(itemAt(10, items)).toBe(0);
    expect(itemAt(150, items)).toBe(2);
    expect(itemAt(69, items)).toBe(0);
    expect(itemAt(-30, items)).toBe(0);
    expect(itemAt(999, items)).toBe(4);
  });
  it('Linse folgt dem Finger, bleibt aber zwischen erstem und letztem Punkt', () => {
    expect(lensCenter(100, items)).toBe(100);
    expect(lensCenter(0, items)).toBe(34);
    expect(lensCenter(400, items)).toBe(314);
  });
});
