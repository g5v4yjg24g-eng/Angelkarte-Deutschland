// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { getWaterRules, saveWaterRules } from './waterRulesService';

describe('Eigene Gewässerregeln (LAW-8)', () => {
  it('speichern, ändern, leeren entfernt; erneut speichern stellt wieder her', async () => {
    const db = freshDb();
    expect(await getWaterRules('osm:r1', db)).toBeUndefined();
    const a = await saveWaterRules('osm:r1', '  Hecht ab 60 cm  ', db);
    expect(a).toMatchObject({ id: 'waterrules-osm:r1', waterId: 'osm:r1', text: 'Hecht ab 60 cm' });
    await saveWaterRules('osm:r1', 'Hecht ab 60 cm, kein Nachtangeln', db);
    expect((await getWaterRules('osm:r1', db))?.text).toBe('Hecht ab 60 cm, kein Nachtangeln');
    expect(await saveWaterRules('osm:r1', '   ', db)).toBeUndefined();
    expect(await getWaterRules('osm:r1', db)).toBeUndefined();
    await saveWaterRules('osm:r1', 'Zander ab 50 cm', db);
    expect((await getWaterRules('osm:r1', db))?.text).toBe('Zander ab 50 cm');
    expect(await getWaterRules('osm:r2', db)).toBeUndefined();
  });
});
