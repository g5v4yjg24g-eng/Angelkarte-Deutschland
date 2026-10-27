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

    const v2 = new FangpunktDB(
      name,
      SCHEMA_VERSIONS.filter((v) => v.version <= 2),
    );
    await v2.open();
    expect(v2.verno).toBe(2);
    expect(await v2.catches.count()).toBe(1);
    expect(await v2.places.count()).toBe(1);
    const t = await repo('trips', v2).create({ date: '2026-10-24', from: '06:00', tz: 'Europe/Berlin' });
    expect(await v2.trips.where('date').equals('2026-10-24').first()).toEqual(t);
    v2.close();
  });

  it('Upgrade v2 → v3 (Session-Routen): Sessions und Fänge bleiben, Routen sind speicherbar', async () => {
    const v2 = freshDb(SCHEMA_VERSIONS.filter((v) => v.version <= 2));
    const name = v2.name;
    const s = await repo('sessions', v2).create({
      startAt: '2026-10-20T06:00:00+02:00',
      tz: 'Europe/Berlin',
    });
    await repo('catches', v2).create({
      outcome: 'caught',
      at: '2026-10-20T07:10:00+02:00',
      tz: 'Europe/Berlin',
      sessionId: s.id,
    });
    expect(v2.verno).toBe(2);
    v2.close();

    const v3 = new FangpunktDB(
      name,
      SCHEMA_VERSIONS.filter((v) => v.version <= 3),
    );
    await v3.open();
    expect(v3.verno).toBe(3);
    expect(await v3.sessions.get(s.id)).toEqual(s);
    expect(await v3.catches.where('sessionId').equals(s.id).count()).toBe(1);
    const tr = await repo('tracks', v3).create({
      id: `track-${s.id}`,
      sessionId: s.id,
      segments: [[{ t: 1781500000000, lat: 51.3, lng: 6.2, acc: 5 }]],
    });
    expect(await v3.tracks.where('sessionId').equals(s.id).first()).toEqual(tr);
    v3.close();
  });

  it('Upgrade v3 → v4 (Gewässer-Links): Daten bleiben, eigene Links sind speicherbar', async () => {
    const v3 = freshDb(SCHEMA_VERSIONS.filter((v) => v.version <= 3));
    const name = v3.name;
    const c = await repo('catches', v3).create({
      outcome: 'caught',
      at: '2026-10-20T07:10:00+02:00',
      tz: 'Europe/Berlin',
      waterId: 'osm:r9075175',
    });
    expect(v3.verno).toBe(3);
    v3.close();

    const v4 = new FangpunktDB(
      name,
      SCHEMA_VERSIONS.filter((v) => v.version <= 4),
    );
    await v4.open();
    expect(v4.verno).toBe(4);
    expect(await v4.catches.get(c.id)).toEqual(c);
    const l = await repo('waterLinks', v4).create({
      id: 'waterlink-osm:r9075175',
      waterId: 'osm:r9075175',
      url: 'https://verein.example/gastkarten',
    });
    expect(await v4.waterLinks.where('waterId').equals('osm:r9075175').first()).toEqual(l);
    v4.close();
  });

  it('Upgrade v4 → v5 (Profil): Daten bleiben, Profil und Beiträge sind speicherbar', async () => {
    const v4 = freshDb(SCHEMA_VERSIONS.filter((v) => v.version <= 4));
    const name = v4.name;
    const c = await repo('catches', v4).create({
      outcome: 'caught',
      at: '2026-10-20T07:10:00+02:00',
      tz: 'Europe/Berlin',
    });
    expect(v4.verno).toBe(4);
    v4.close();

    const v5 = new FangpunktDB(
      name,
      SCHEMA_VERSIONS.filter((v) => v.version <= 5),
    );
    await v5.open();
    expect(v5.verno).toBe(5);
    expect(await v5.catches.get(c.id)).toEqual(c);
    const p = await repo('profiles', v5).create({ id: 'me', name: 'Kevin' });
    expect(await v5.profiles.get('me')).toEqual(p);
    const post = await repo('posts', v5).create({ photoIds: ['f1'], catchId: c.id });
    expect(await v5.posts.where('catchId').equals(c.id).first()).toEqual(post);
    v5.close();
  });

  it('Upgrade v5 → v6 (Gefällt mir, Kommentare): Beiträge bleiben, Reaktionen sind speicherbar', async () => {
    const v5 = freshDb(SCHEMA_VERSIONS.filter((v) => v.version <= 5));
    const name = v5.name;
    const post = await repo('posts', v5).create({ photoIds: ['f1'] });
    v5.close();

    const v6 = new FangpunktDB(name);
    await v6.open();
    expect(v6.verno).toBe(6);
    expect(await v6.posts.get(post.id)).toEqual(post);
    const like = await repo('postLikes', v6).create({
      id: `like-me-${post.id}`,
      postId: post.id,
      authorId: 'me',
    });
    const c = await repo('postComments', v6).create({ postId: post.id, authorId: 'me', text: 'Petri!' });
    expect(await v6.postLikes.where('postId').equals(post.id).toArray()).toEqual([like]);
    expect(await v6.postComments.where('postId').equals(post.id).toArray()).toEqual([c]);
    v6.close();
  });
});
