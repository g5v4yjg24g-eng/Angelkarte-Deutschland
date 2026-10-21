// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convertLegacy, decodeDataUrl, isLegacyBackup } from './legacy';
import { legacyExport, TINY_JPEG } from '../../test/fixtures/legacy-angelkarte-v2';

describe('BAK-7: Import der Alt-App', () => {
  const ids = (() => {
    let i = 0;
    return () => `neu-${++i}`;
  })();
  const r = convertLegacy(legacyExport, ids);

  it('erkennt Alt-App-Sicherungen, aber keine fremden Dateien', () => {
    expect(isLegacyBackup(legacyExport)).toBe(true);
    expect(isLegacyBackup({ format: 'fangpunkt-backup' })).toBe(false);
    expect(isLegacyBackup({ app: 'etwas-anderes', entries: [] })).toBe(false);
  });

  it('übernimmt gültige Einträge und meldet ungültige mit Grund', () => {
    expect(r.catches).toHaveLength(3);
    expect(r.invalid.map((x) => [x.id, x.reason])).toEqual([
      ['kaputt-1', 'Unbekanntes Ergebnis „unbekannt"'],
      ['kaputt-2', 'Koordinaten fehlen'],
    ]);
  });

  it('bildet einen Fang vollständig ab', () => {
    const c = r.catches.find((x) => x.id.endsWith('111111111111'));
    expect(c).toMatchObject({
      outcome: 'caught',
      at: '2026-06-14T07:10:00+02:00',
      tz: 'Europe/Berlin',
      position: { lat: 51.32631, lng: 6.24172, source: 'import' },
      waterSnapshot: { name: 'Großer De Witt See' },
      speciesId: 'pike',
      speciesCertainty: 'certain',
      lengthCm: 68,
      lengthMethod: 'measured',
      weightG: 2100,
      weightMethod: 'estimated',
      released: 'released',
      bait: { name: 'Shad 12 cm', type: 'softbait', color: 'Motoroil', weightG: 10 },
      retrieve: 'Faulenzen',
      depthFishedM: 3.5,
      contactIntensity: 4,
      conditions: {
        sky: 'cloudy',
        cloudCover: '75-100',
        airTempC: 17.5,
        waterTempC: 19,
        windBft: 3,
        windDir: 'SW',
        pressureHpa: 1012,
        pressureTrend: 'falling',
        turbidity: 'slightly_turbid',
        waterPlants: 'few',
      },
      sessionId: 'aaaaaaaa-0000-4000-8000-000000000001',
      photoIds: ['6f1d3c1e-0a6b-4b51-9a2b-111111111111-photo'],
    });
    expect(c?.method).toBeUndefined();
    expect(c?.notes).toBe('Am Schilfrand\nGröße: Bauch voll');
    expect(c?.legacy?.raw.wx).toEqual({ temp: 17.3, src: 'forecast' });
    expect(c?.legacy?.raw).not.toHaveProperty('photo');
  });

  it('bildet Kontakt, Fehlbiss und unsichere Art ab', () => {
    const lost = r.catches.find((x) => x.id.endsWith('222222222222'));
    expect(lost).toMatchObject({
      outcome: 'contact',
      contactDetail: 'lost_in_fight',
      speciesId: 'zander',
      speciesCertainty: 'guess',
      lengthCm: 50,
      lengthMethod: 'estimated',
      method: 'dropshot',
      contactIntensity: 5,
    });
    const bite = r.catches.find((x) => x.id.endsWith('333333333333'));
    expect(bite?.outcome).toBe('missed_bite');
    expect(bite?.speciesId).toBeUndefined();
  });

  it('übernimmt Sessions, Stege und Angelplätze; Termine werden gemeldet', () => {
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0]).toMatchObject({
      startAt: '2026-06-14T06:30:00+02:00',
      endAt: '2026-06-14T10:00:00+02:00',
    });
    expect(r.places.map((p) => [p.id, p.type, p.name])).toEqual([
      ['p-1', 'jetty', 'Steg Nord'],
      ['p-2', 'spot', undefined],
    ]);
    expect(r.notes.join(' ')).toMatch(/1 geplanter Termin aus dem Angelkalender wird nicht übernommen/);
  });

  it('dekodiert das Foto', () => {
    expect(r.photos).toHaveLength(1);
    const d = decodeDataUrl(TINY_JPEG);
    expect(d?.mime).toBe('image/jpeg');
    expect(r.photos[0]?.bytes).toEqual(d?.bytes);
    expect(r.photos[0]?.bytes[0]).toBe(0xff);
  });
});
