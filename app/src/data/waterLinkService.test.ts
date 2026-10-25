// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { getWaterLink, removeWaterLink, saveWaterLink } from './waterLinkService';

describe('Eigener Link zur Angelkarte (PRM-3)', () => {
  it('speichern, ändern, entfernen, wieder speichern – ein Link je Gewässer', async () => {
    const db = freshDb();
    expect(await getWaterLink('osm:w1', db)).toBeUndefined();
    const a = await saveWaterLink('osm:w1', 'https://verein.de/', 'ASV', db);
    expect(a).toMatchObject({
      id: 'waterlink-osm:w1',
      waterId: 'osm:w1',
      url: 'https://verein.de/',
      label: 'ASV',
    });
    const b = await saveWaterLink('osm:w1', 'https://verein.de/gastkarten', undefined, db);
    expect(b.rev).toBe(1);
    expect(b.label).toBeUndefined();
    await removeWaterLink('osm:w1', db);
    expect(await getWaterLink('osm:w1', db)).toBeUndefined();
    const c = await saveWaterLink('osm:w1', 'https://neu.de/', undefined, db);
    expect(c.deletedAt).toBeUndefined();
    expect(await db.waterLinks.count()).toBe(1);
    await expect(saveWaterLink('osm:w2', 'javascript:alert(1)', undefined, db)).rejects.toThrow();
  });
});
