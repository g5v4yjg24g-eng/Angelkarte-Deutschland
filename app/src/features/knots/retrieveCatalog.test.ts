import { describe, expect, it } from 'vitest';
import { rigProblems, rigStepCount } from '../../domain/rigs';
import { de } from '../../i18n/de';
import { RETRIEVE_ZONES, RETRIEVES } from './retrieveCatalog';
import { RIGS } from './rigCatalog';

describe('Köderführung-Katalog (RET-1)', () => {
  it('acht Techniken, eindeutige Adressen, beide Wassertiefen, Texte vollständig', () => {
    expect(RETRIEVES).toHaveLength(8);
    expect(new Set(RETRIEVES.map((r) => r.slug)).size).toBe(8);
    for (const z of RETRIEVE_ZONES) expect(RETRIEVES.some((r) => r.zone === z)).toBe(true);
    for (const r of RETRIEVES) {
      const text = de.retrieves.items[r.id];
      for (const v of [text.name, text.short, text.fish]) expect(v).not.toBe('');
      expect(text.purpose.length).toBeGreaterThan(0);
      expect(text.baits.length).toBeGreaterThan(0);
      for (const id of r.rigs) expect(RIGS.some((x) => x.id === id)).toBe(true);
    }
  });

  for (const r of RETRIEVES) {
    it(`${r.id}: Zeichnung ohne Fehler, ein Bild je Schritt, jeder Schritt bewegt den Köder, Beschriftungen übersetzt`, () => {
      expect(rigProblems(r.diagram)).toEqual([]);
      expect(r.diagram.lure).toBe(true);
      const steps = rigStepCount(r.diagram);
      expect(steps).toBe(de.retrieves.items[r.id].steps.length);
      for (let s = 0; s < steps; s++)
        expect(r.diagram.parts.some((p) => p.step === s && p.style === 'trail')).toBe(true);
      for (const p of r.diagram.parts)
        if (p.label) expect(Object.keys(de.retrieves.labels)).toContain(p.label.key);
    });
  }
});
