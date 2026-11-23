import { describe, expect, it } from 'vitest';
import { loadRegulation } from './regulations';
import { findings } from '../domain/regulationCheck';
import { STATE_CODES } from '../domain/water';

describe('loadRegulation', () => {
  // Seit 2026-10-25 haben alle 16 Länder eine gegengeprüfte Datei (Leerzustand: StateLawPage.test.tsx)
  it('alle Länder werden geladen', async () => {
    for (const code of STATE_CODES) expect((await loadRegulation(code)).kind, code).toBe('ok');
  });

  it('gegengeprüftes Land wird geladen', async () => {
    const r = await loadRegulation('BY');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.set.status).toBe('partial');
  });
});

// Neu ergänzte Arten (2026-11-19) sind mit den Regeln der Landesverordnungen verknüpft (2026-11-23, nur wo der
// wissenschaftliche Name im Rechtstext eindeutig zur Fangbuch-Art passt)
describe('Regeln für Arten ab 2026-11-19', () => {
  const day = (iso: string) => ({ outcome: 'caught' as const, at: iso, released: undefined });
  it('NRW: Seeforelle in der Schonzeit und Schneider ganzjährig geschont', async () => {
    const r = await loadRegulation('NW');
    if (r.kind !== 'ok') throw new Error('NW fehlt');
    const lake = findings(r.set, { ...day('2026-11-10T12:00:00Z'), speciesId: 'lake_trout' });
    expect(lake.some((f) => f.kind === 'closed')).toBe(true);
    const spirlin = findings(r.set, { ...day('2026-06-10T12:00:00Z'), speciesId: 'spirlin' });
    expect(spirlin.some((f) => f.kind === 'protected')).toBe(true);
  });
  it('Bayern: Huchen hat Schonzeit und Mindestmaß', async () => {
    const r = await loadRegulation('BY');
    if (r.kind !== 'ok') throw new Error('BY fehlt');
    expect(r.set.closedSeasons.some((x) => x.speciesId === 'huchen')).toBe(true);
    expect(r.set.minSizes.some((x) => x.speciesId === 'huchen')).toBe(true);
  });
  it('Stör ist nur verknüpft, wo der Text alle Störe meint (Brandenburg: Familie Acipenseridae)', async () => {
    for (const code of STATE_CODES) {
      const r = await loadRegulation(code);
      if (r.kind !== 'ok') continue;
      const all = [...r.set.closedSeasons, ...r.set.minSizes, ...r.set.protectedSpecies];
      const linked = all.some((x) => x.speciesId === 'sturgeon' || x.alsoSpeciesIds?.includes('sturgeon'));
      expect(linked, code).toBe(code === 'BB');
    }
  });
  it('Hessen: Atlantische Forelle gilt für Bach-, Meer- und Seeforelle', async () => {
    const r = await loadRegulation('HE');
    if (r.kind !== 'ok') throw new Error('HE fehlt');
    for (const id of ['brown_trout', 'sea_trout', 'lake_trout']) {
      const f = findings(r.set, {
        outcome: 'caught',
        at: '2026-11-10T12:00:00Z',
        released: undefined,
        speciesId: id,
      });
      expect(
        f.some((x) => x.kind === 'closed'),
        id,
      ).toBe(true);
      const small = findings(r.set, {
        outcome: 'caught',
        at: '2026-07-10T12:00:00Z',
        released: undefined,
        speciesId: id,
        lengthCm: 20,
      });
      expect(
        small.some((x) => x.kind === 'undersize'),
        id,
      ).toBe(true);
    }
  });
  it('Sachsen: „Alosa spec.“ schützt Maifisch und Finte', async () => {
    const r = await loadRegulation('SN');
    if (r.kind !== 'ok') throw new Error('SN fehlt');
    for (const id of ['allis_shad', 'twaite_shad']) {
      const f = findings(r.set, {
        outcome: 'caught',
        at: '2026-06-10T12:00:00Z',
        released: undefined,
        speciesId: id,
      });
      expect(
        f.some((x) => x.kind === 'protected'),
        id,
      ).toBe(true);
    }
  });
});
