// LAW-1: jede Landesdatei muss dem Schema genügen (auch `pnpm validate:data`). Veraltete Prüfstände warnen nur.
import { describe, expect, it } from 'vitest';
import { freshness, isStateCode, RegulationSetSchema } from '../domain/regulations';

// Ohne Typparameter: mit `glob<…>(` erkennt Vite den Aufruf nicht und liefert {}.
const files: Record<string, unknown> = import.meta.glob('../../data/regulations/*.json', {
  import: 'default',
  eager: true,
});

describe('Landesdateien app/data/regulations', () => {
  it('findet die Landesdateien', () => expect(Object.keys(files).length).toBeGreaterThan(0));

  for (const [path, data] of Object.entries(files)) {
    const code = (path.split('/').at(-1) ?? '').replace(/\.json$/, '');
    it(`${code}.json`, () => {
      expect(isStateCode(code), 'Dateiname = Länderkürzel').toBe(true);
      const r = RegulationSetSchema.safeParse(data);
      const problems = r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      expect(problems).toEqual([]);
      if (!r.success) return;
      expect(r.data.stateCode).toBe(code);
      const f = freshness(r.data.checkedAt, Date.now());
      if (f !== 'current') console.warn(`${code}: zuletzt geprüft ${r.data.checkedAt} (${f})`);
    });
  }

  it('Lachs und Meerforelle sind mit der Fangbuch-Art verknüpft, Stör nicht (Gattung ≠ Europäischer Stör)', () => {
    type Rule = { taxon: { de: string }; speciesId?: string };
    for (const [path, data] of Object.entries(files)) {
      const d = data as Record<'closedSeasons' | 'minSizes' | 'protectedSpecies', Rule[]>;
      for (const r of [...d.closedSeasons, ...d.minSizes, ...d.protectedSpecies]) {
        if (/^(Atlantischer )?Lachs$/.test(r.taxon.de)) expect(r.speciesId, path).toBe('salmon');
        if (r.taxon.de === 'Meerforelle') expect(r.speciesId, path).toBe('sea_trout');
        if (/Stör/.test(r.taxon.de)) expect(r.speciesId, path).toBeUndefined();
      }
    }
  });
});
