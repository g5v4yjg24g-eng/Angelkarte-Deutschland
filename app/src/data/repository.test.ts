// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { repo, TRASH_DAYS } from './repository';
import { ValidationError } from './errors';

const place = { type: 'spot' as const, position: { lat: 51.3, lng: 6.2, source: 'map-tap' as const } };

describe('Repository', () => {
  it('legt an, setzt Metadaten und zählt die Revision hoch', async () => {
    const r = repo('places', freshDb());
    const p = await r.create({ ...place, name: 'Steg' });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.rev).toBe(0);
    expect(p.createdAt).toMatch(/[+-]\d{2}:\d{2}$/);
    const u = await r.update(p.id, { name: 'Steg Nord' });
    expect(u.rev).toBe(1);
    expect((await r.get(p.id))?.name).toBe('Steg Nord');
  });

  it('weist ungültige Daten mit verständlicher Meldung ab und speichert nichts', async () => {
    const r = repo('places', freshDb());
    await expect(
      r.create({ ...place, position: { lat: 200, lng: 6, source: 'gps' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await r.list({ includeDeleted: true })).toHaveLength(0);
  });

  it('CAT-4/CAT-3: Fang mit 900 cm oder „gewogenem" Fehlbiss wird abgelehnt', async () => {
    const r = repo('catches', freshDb());
    const base = { at: '2026-06-14T07:10:00+02:00', tz: 'Europe/Berlin' };
    await expect(r.create({ ...base, outcome: 'caught', lengthCm: 900 })).rejects.toThrow(/lengthCm/);
    await expect(
      r.create({ ...base, outcome: 'missed_bite', weightG: 500, weightMethod: 'weighed' }),
    ).rejects.toThrow(/gelandeten Fang/);
    await expect(
      r.create({ ...base, outcome: 'caught', lengthCm: 68, lengthMethod: 'measured' }),
    ).resolves.toBeTruthy();
  });

  it('löscht weich, stellt wieder her und leert den Papierkorb erst nach Ablauf', async () => {
    const r = repo('places', freshDb());
    const p = await r.create(place);
    await r.remove(p.id);
    expect(await r.list()).toHaveLength(0);
    expect(await r.list({ includeDeleted: true })).toHaveLength(1);
    await r.restore(p.id);
    expect(await r.list()).toHaveLength(1);
    await r.remove(p.id);
    expect(await r.purgeTrash(Date.now() + (TRASH_DAYS - 1) * 864e5)).toBe(0);
    expect(await r.purgeTrash(Date.now() + (TRASH_DAYS + 1) * 864e5)).toBe(1);
  });
});
