// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { FangpunktDB, SCHEMA_VERSIONS } from './db';
import { repo } from './repository';

describe('Migrationen', () => {
  it('Upgrade v1 → v2 (Probe-Migration) behält alle Daten und führt die Umwandlung aus', async () => {
    const v1 = freshDb();
    const name = v1.name;
    const r = repo('places', v1);
    const a = await r.create({ type: 'spot', position: { lat: 51, lng: 7, source: 'gps' }, name: 'A' });
    await repo('catches', v1).create({
      outcome: 'caught',
      at: '2026-06-14T07:10:00+02:00',
      tz: 'Europe/Berlin',
    });
    v1.close();

    // Probe-Version 2: neuer Index und Datenumwandlung
    const v2 = new FangpunktDB(name, [
      ...SCHEMA_VERSIONS,
      {
        version: 2,
        stores: { places: 'id, type, waterId, updatedAt, deletedAt, name' },
        upgrade: async (tx) => {
          await tx
            .table('places')
            .toCollection()
            .modify((p: { name?: string }) => {
              p.name = (p.name ?? '').toUpperCase();
            });
        },
      },
    ]);
    await v2.open();
    expect(v2.verno).toBe(2);
    expect((await v2.places.get(a.id))?.name).toBe('A'.toUpperCase());
    expect(await v2.catches.count()).toBe(1);
    expect(await v2.places.where('name').equals('A').count()).toBe(1);
    v2.close();
  });
});
