import { describe, expect, it } from 'vitest';
import { buildDiagram } from '../../domain/knots';
import { de } from '../../i18n/de';
import { KNOTS } from './catalog';

describe('Knoten-Katalog (KNT-2)', () => {
  it('neun Knoten mit Namen und Kurzbeschreibung, eindeutige Adressen', () => {
    expect(KNOTS).toHaveLength(9);
    expect(new Set(KNOTS.map((k) => k.slug)).size).toBe(9);
    for (const k of KNOTS) {
      expect(de.knots.items[k.id].name).not.toBe('');
      expect(de.knots.items[k.id].short).not.toBe('');
    }
  });

  for (const k of KNOTS.filter((x) => x.diagram)) {
    it(`${k.id}: Zeichnung ohne Widersprüche, ein Bild je Schritt`, () => {
      const d = buildDiagram(k.diagram as NonNullable<typeof k.diagram>);
      expect(d.problems).toEqual([]);
      const text = de.knots.items[k.id];
      expect('steps' in text && text.steps.length).toBe(d.steps);
    });
  }

  it('alle neun Knoten sind animiert', () => {
    expect(KNOTS.filter((k) => !k.diagram)).toEqual([]);
  });
});
