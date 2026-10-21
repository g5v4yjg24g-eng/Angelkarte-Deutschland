import { describe, expect, it } from 'vitest';
import type { Catch } from './schemas';
import {
  draftFromCatch,
  draftToFields,
  emptyDraft,
  filterCatches,
  groupByDay,
  NO_FILTER,
  parseDecimal,
  recentBaits,
  recentSpecies,
  waterNames,
  type CatchDraft,
} from './catchDraft';

const NOW = Date.parse('2026-10-21T12:00:00Z'); // 14:00 in Berlin (Sommerzeit)

function draft(over: Partial<CatchDraft> = {}): CatchDraft {
  return { ...emptyDraft(NOW), ...over };
}

function entry(over: Partial<Catch>): Catch {
  return {
    id: over.id ?? crypto.randomUUID(),
    createdAt: '2026-10-01T10:00:00+02:00',
    updatedAt: '2026-10-01T10:00:00+02:00',
    rev: 0,
    outcome: 'caught',
    at: '2026-10-01T10:00:00+02:00',
    tz: 'Europe/Berlin',
    ...over,
  };
}

describe('Fangformular', () => {
  it('beginnt mit „Fang" und der aktuellen Ortszeit', () => {
    expect(emptyDraft(NOW)).toMatchObject({ outcome: 'caught', date: '2026-10-21', time: '14:00' });
  });

  it('CAT-1: Typ + Zeit genügen', () => {
    const { fields, errors } = draftToFields(draft());
    expect(errors).toEqual({});
    expect(fields).toMatchObject({ outcome: 'caught', at: '2026-10-21T14:00:00+02:00', tz: 'Europe/Berlin' });
    expect(fields?.bait).toBeUndefined();
    expect(fields?.conditions).toBeUndefined();
  });

  it('liest Zahlen mit Komma, rechnet kg in g um', () => {
    expect(parseDecimal(' 12,5 ')).toBe(12.5);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('12 cm')).toBeNaN();
    const { fields } = draftToFields(draft({ lengthCm: '54,5', weightKg: '1,25', speciesId: 'zander' }));
    expect(fields).toMatchObject({
      lengthCm: 54.5,
      lengthMethod: 'measured',
      weightG: 1250,
      weightMethod: 'weighed',
      speciesId: 'zander',
    });
  });

  it('CAT-4: ungültige Werte werden dem Feld zugeordnet, nichts wird gespeichert', () => {
    expect(draftToFields(draft({ lengthCm: '900' }))).toEqual({ errors: { lengthCm: 'range' } });
    expect(draftToFields(draft({ weightKg: 'schwer' }))).toEqual({ errors: { weightKg: 'number' } });
    expect(draftToFields(draft({ windBft: '15', waterTempC: '-3' })).errors).toEqual({
      windBft: 'range',
      waterTempC: 'range',
    });
    expect(draftToFields(draft({ date: '' })).errors).toEqual({ date: 'date' });
  });

  it('CAT-3: Kontakt und Fehlbiss haben keine Messwerte', () => {
    const contact = draftToFields(
      draft({
        outcome: 'contact',
        lengthCm: '60',
        weightKg: '2',
        released: 'kept',
        contactDetail: 'lost_in_fight',
      }),
    ).fields;
    expect(contact).toMatchObject({
      lengthMethod: 'estimated',
      weightMethod: 'estimated',
      contactDetail: 'lost_in_fight',
    });
    expect(contact?.released).toBeUndefined();
    const miss = draftToFields(draft({ outcome: 'missed_bite', lengthCm: '60', speciesId: 'pike' })).fields;
    expect(miss?.lengthCm).toBeUndefined();
    expect(miss?.speciesId).toBeUndefined();
    const obs = draftToFields(
      draft({ outcome: 'observation', speciesId: 'asp', contactDetail: 'lost_in_fight' }),
    ).fields;
    expect(obs).toMatchObject({ speciesId: 'asp' });
    expect(obs?.contactDetail).toBeUndefined();
  });

  it('Bearbeiten erhält Angaben, die das Formular nicht zeigt', () => {
    const base = entry({
      outcome: 'caught',
      at: '2026-06-01T05:30:00+02:00',
      weightG: 800,
      weightMethod: 'calculated',
      bait: { name: 'Gummifisch', type: 'softbait', color: 'Motoroil', sizeCm: 10 },
      conditions: { pressureHpa: 1012, airTempC: 18 },
    });
    const d = draftFromCatch(base);
    expect(d).toMatchObject({
      date: '2026-06-01',
      time: '05:30',
      weightKg: '0,8',
      baitName: 'Gummifisch',
      airTempC: '18',
    });
    const { fields } = draftToFields({ ...d, notes: 'Schöner Biss' }, { base });
    expect(fields).toMatchObject({
      at: '2026-06-01T05:30:00+02:00',
      weightG: 800,
      weightMethod: 'calculated',
      bait: { name: 'Gummifisch', type: 'softbait', color: 'Motoroil', sizeCm: 10 },
      conditions: { pressureHpa: 1012, airTempC: 18 },
      notes: 'Schöner Biss',
    });
    // Geändertes Gewicht ist nicht mehr „berechnet"
    expect(
      draftToFields({ ...d, weightKg: '0,9', weightMethod: 'weighed' }, { base }).fields?.weightMethod,
    ).toBe('weighed');
  });

  it('Winterzeit bekommt den richtigen Offset', () => {
    expect(draftToFields(draft({ date: '2026-12-24', time: '08:15' })).fields?.at).toBe(
      '2026-12-24T08:15:00+01:00',
    );
  });
});

describe('Fangbuch-Liste', () => {
  const list = [
    entry({
      id: 'a',
      at: '2026-10-20T18:00:00+02:00',
      speciesId: 'zander',
      waterSnapshot: { name: 'De Wittsee' },
    }),
    entry({
      id: 'b',
      at: '2026-10-20T07:00:00+02:00',
      outcome: 'contact',
      speciesId: 'pike',
      bait: { name: 'Spinner Gr. 3' },
    }),
    entry({ id: 'c', at: '2025-05-01T10:00:00+02:00', speciesId: 'zander', notes: 'Hochwasser' }),
    entry({
      id: 'd',
      at: '2026-10-19T10:00:00+02:00',
      deletedAt: '2026-10-19T11:00:00+02:00',
      speciesId: 'carp',
    }),
  ];
  const opts = { nowMs: NOW, speciesName: (id?: string) => ({ zander: 'Zander', pike: 'Hecht' })[id ?? ''] };

  it('neueste zuerst, ohne Papierkorb', () => {
    expect(filterCatches(list, NO_FILTER, opts).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('Filter lassen sich kombinieren', () => {
    expect(
      filterCatches(list, { ...NO_FILTER, speciesId: 'zander', period: 'year' }, opts).map((c) => c.id),
    ).toEqual(['a']);
    expect(filterCatches(list, { ...NO_FILTER, outcome: 'contact' }, opts).map((c) => c.id)).toEqual(['b']);
    expect(filterCatches(list, { ...NO_FILTER, water: 'De Wittsee' }, opts).map((c) => c.id)).toEqual(['a']);
    expect(filterCatches(list, { ...NO_FILTER, period: '7d' }, opts).map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('Textsuche in Art, Gewässer, Köder und Notizen', () => {
    const ids = (text: string) => filterCatches(list, { ...NO_FILTER, text }, opts).map((c) => c.id);
    expect(ids('hecht')).toEqual(['b']);
    expect(ids('witt')).toEqual(['a']);
    expect(ids('spinner')).toEqual(['b']);
    expect(ids('HOCHWASSER')).toEqual(['c']);
  });
  it('gruppiert nach Tag', () => {
    expect(groupByDay(filterCatches(list, NO_FILTER, opts)).map((g) => [g.day, g.items.length])).toEqual([
      ['2026-10-20', 2],
      ['2025-05-01', 1],
    ]);
  });
  it('Schnellauswahl: zuletzt genutzte Arten, Köder und Gewässer', () => {
    expect(recentSpecies(list)).toEqual(['zander', 'pike']);
    expect(recentBaits(list)).toEqual([{ name: 'Spinner Gr. 3' }]);
    expect(waterNames(list)).toEqual(['De Wittsee']);
  });
});
