// LAW-1: jede Landesdatei muss dem Schema genügen (auch `pnpm validate:data`). Veraltete Prüfstände warnen nur.
import { describe, expect, it } from 'vitest';
import { freshness, isStateCode, RegulationSetSchema } from '../domain/regulations';

const files = import.meta.glob<unknown>('../../data/regulations/*.json', { import: 'default', eager: true });

describe('Landesdateien app/data/regulations', () => {
  it('Glob findet die Ablage', () => expect(typeof files).toBe('object'));

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
});
