// PRM-2: Gewässerkarten-Dateien in app/data/permits müssen dem Schema genügen (auch `pnpm validate:data`).
import { describe, expect, it } from 'vitest';
import { AssociationFileSchema, WaterPermitListSchema } from '../domain/permits';
import { STATE_CODES } from '../domain/water';
import waters from '../../data/permits/waters.json';
import associations from '../../data/permits/associations.json';

const problems = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);

describe('Gewässerkarten-Daten app/data/permits', () => {
  it('waters.json', () => expect(problems(WaterPermitListSchema.safeParse(waters))).toEqual([]));

  it('associations.json: jedes Land hat einen geprüften Verband oder steht mit Grund unter „open“', () => {
    const r = AssociationFileSchema.safeParse(associations);
    expect(problems(r)).toEqual([]);
    if (!r.success) return;
    const covered = new Set([...r.data.associations.map((a) => a.state), ...r.data.open.map((o) => o.state)]);
    expect(STATE_CODES.filter((s) => !covered.has(s))).toEqual([]);
    const both = r.data.open.filter((o) => r.data.associations.some((a) => a.state === o.state));
    expect(both).toEqual([]);
  });
});
