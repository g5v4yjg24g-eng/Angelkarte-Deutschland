import { describe, expect, it } from 'vitest';
import { fitSize } from './photo';

describe('fitSize', () => {
  it('verkleinert auf die längste Kante, Seitenverhältnis bleibt', () => {
    expect(fitSize(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(4000, 1000, 320)).toEqual({ width: 320, height: 80 });
  });
  it('vergrößert kleine Bilder nicht', () =>
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 }));
  it('lehnt unsinnige Größen ab', () => expect(() => fitSize(0, 10, 100)).toThrow());
});
