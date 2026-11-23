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
  it('Stör bleibt unverknüpft (Gattung, nicht nur der geschützte Europäische Stör)', async () => {
    for (const code of STATE_CODES) {
      const r = await loadRegulation(code);
      if (r.kind !== 'ok') continue;
      const all = [...r.set.closedSeasons, ...r.set.minSizes, ...r.set.protectedSpecies];
      expect(all.some((x) => x.speciesId === 'sturgeon'), code).toBe(false);
    }
  });
});
