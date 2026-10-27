import { describe, expect, it } from 'vitest';
import { rigProblems, rigStepCount } from '../../domain/rigs';
import { de } from '../../i18n/de';
import { KNOTS } from './catalog';
import { RIG_METHODS, RIGS } from './rigCatalog';

describe('Montagen-Katalog (RIG-2)', () => {
  it('acht Montagen, eindeutige Adressen, jede Angelart vertreten, Texte vollständig', () => {
    expect(RIGS).toHaveLength(8);
    expect(new Set(RIGS.map((r) => r.slug)).size).toBe(8);
    for (const m of RIG_METHODS) expect(RIGS.some((r) => r.method === m)).toBe(true);
    for (const r of RIGS) {
      const text = de.rigs.items[r.id];
      expect(text.name).not.toBe('');
      expect(text.short).not.toBe('');
      expect(text.fish).not.toBe('');
      expect(text.purpose.length).toBeGreaterThan(0);
      expect(text.material.length).toBeGreaterThan(0);
      for (const k of r.knots) expect(KNOTS.some((x) => x.id === k)).toBe(true);
    }
  });

  for (const r of RIGS) {
    it(`${r.id}: Zeichnung ohne Widersprüche, ein Bild je Schritt, alle Beschriftungen übersetzt`, () => {
      expect(rigProblems(r.diagram)).toEqual([]);
      expect(rigStepCount(r.diagram)).toBe(de.rigs.items[r.id].steps.length);
      for (const p of r.diagram.parts) if (p.label) expect(Object.keys(de.rigs.parts)).toContain(p.label.key);
    });
  }
});
