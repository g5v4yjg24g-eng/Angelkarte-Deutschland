// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { FangpunktDB, SCHEMA_VERSION, SCHEMA_VERSIONS } from './db';
import { repo } from './repository';

describe('Migrationen', () => {
  it('Upgrade auf eine Probe-Version behält alle Daten und führt die Umwandlung aus', async () => {
    const v1 = freshDb();
    const name = v1.name;
    const next = SCHEMA_VERSION + 1;
    const r = repo('places', v1);
    const a = await r.create({ type: 'spot', position: { lat: 51, lng: 7, source: 'gps' }, name: 'A' });
    await repo('catches', v1).create({
      outcome: 'caught',
      at: '2026-06-14T07:10:00+02:00',
      tz: 'Europe/Berlin',
    });
    v1.close();

    // Probe-Version: neuer Index und Datenumwandlung
    const v2 = new FangpunktDB(name, [
      ...SCHEMA_VERSIONS,
      {
        version: next,
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
    expect(v2.verno).toBe(next);
    expect((await v2.places.get(a.id))?.name).toBe('A'.toUpperCase());
    expect(await v2.catches.count()).toBe(1);
    expect(await v2.places.where('name').equals('A').count()).toBe(1);
    v2.close();
  });

  it('Upgrade v1 → v2 (Angelkalender): vorhandene Daten bleiben, Termine sind speicherbar', async () => {
    const v1 = freshDb(SCHEMA_VERSIONS.filter((v) => v.version === 1));
    const name = v1.name;
    await repo('catches', v1).create({
      outcome: 'caught',
      at: '2026-06-14T07:10:00+02:00',
      tz: 'Europe/Berlin',
    });
    await repo('places', v1).create({ type: 'jetty', position: { lat: 51, lng: 7, source: 'gps' } });
    expect(v1.verno).toBe(1);
    v1.close();

    const v2 = new FangpunktDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    expect(await v2.catches.count()).toBe(1);
    expect(await v2.places.count()).toBe(1);
    const t = await repo('trips', v2).create({ date: '2026-10-24', from: '06:00', tz: 'Europe/Berlin' });
    expect(await v2.trips.where('date').equals('2026-10-24').first()).toEqual(t);
    v2.close();
  });
});
