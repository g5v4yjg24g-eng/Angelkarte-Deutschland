import { describe, expect, it } from 'vitest';
import type { BaitPreset, Catch } from './schemas';
import {
  emptyPresetDraft,
  presetByName,
  presetDraftFrom,
  presetDraftToFields,
  sortPresets,
} from './baitPreset';
import { applyPreset, draftFromCatch, draftToFields, emptyDraft } from './catchDraft';

const meta = { createdAt: '2026-10-22T10:00:00+02:00', updatedAt: '2026-10-22T10:00:00+02:00', rev: 0 };
const shad: BaitPreset = {
  id: 'p1',
  ...meta,
  label: 'Shad 12 cm',
  bait: { name: 'Shad 12 cm', type: 'softbait', color: 'Motoroil', sizeCm: 12, weightG: 14, hookSize: '3/0' },
  method: 'jigging',
};
const spoon: BaitPreset = {
  id: 'p2',
  ...meta,
  label: 'blinker gold',
  bait: { name: 'blinker gold', type: 'spoon' },
};

describe('Köder-Favoriten: Formular', () => {
  it('Name ist Pflicht; Zahlen mit Komma; Ergebnis passt zum Schema', () => {
    expect(presetDraftToFields(emptyPresetDraft()).errors).toEqual({ name: 'required' });
    const r = presetDraftToFields({
      ...emptyPresetDraft(),
      name: '  Shad   12 cm ',
      type: 'softbait',
      color: 'Motoroil',
      sizeCm: '12',
      weightG: '14,5',
      hookSize: '3/0',
      method: 'jigging',
    });
    expect(r.fields).toEqual({
      label: 'Shad 12 cm',
      bait: {
        name: 'Shad 12 cm',
        type: 'softbait',
        color: 'Motoroil',
        sizeCm: 12,
        weightG: 14.5,
        hookSize: '3/0',
      },
      method: 'jigging',
    });
  });

  it('Eingabefehler und Wertebereiche landen am Feld', () => {
    const r = presetDraftToFields({ ...emptyPresetDraft(), name: 'X', sizeCm: 'zwölf', weightG: '5000' });
    expect(r.errors).toEqual({ sizeCm: 'number' });
    expect(presetDraftToFields({ ...emptyPresetDraft(), name: 'X', weightG: '5000' }).errors).toEqual({
      weightG: 'range',
    });
  });

  it('doppelte Namen (ohne Rücksicht auf Groß-/Kleinschreibung) werden abgelehnt', () => {
    expect(presetDraftToFields({ ...emptyPresetDraft(), name: 'shad 12 CM' }, [shad]).errors).toEqual({
      name: 'duplicate',
    });
    expect(presetByName([shad], ' SHAD 12 cm')?.id).toBe('p1');
  });

  it('Bearbeiten: Formular ↔ Favorit ohne Verlust', () => {
    const d = presetDraftFrom(shad);
    expect(d.weightG).toBe('14');
    expect(presetDraftToFields(d).fields).toEqual({ label: shad.label, bait: shad.bait, method: 'jigging' });
  });

  it('Sortierung alphabetisch, gelöschte fehlen', () => {
    const gone = { ...spoon, id: 'p3', label: 'Alt', deletedAt: '2026-10-22T11:00:00+02:00' };
    expect(sortPresets([shad, spoon, gone]).map((p) => p.id)).toEqual(['p2', 'p1']);
  });
});

describe('Köder-Favoriten im Fangformular', () => {
  const now = Date.parse('2026-10-22T10:00:00Z');

  it('Tipp übernimmt Name, Art und Methode; gespeichert werden auch Farbe, Größe, Gewicht, Haken', () => {
    const d = applyPreset(emptyDraft(now), shad);
    expect(d).toMatchObject({
      baitName: 'Shad 12 cm',
      baitType: 'softbait',
      method: 'jigging',
      baitPresetId: 'p1',
    });
    const { fields } = draftToFields(d, { preset: shad });
    expect(fields?.baitPresetId).toBe('p1');
    expect(fields?.bait).toEqual(shad.bait);
    expect(fields?.method).toBe('jigging');
  });

  it('Methode ohne Angabe im Favoriten bleibt wie gewählt', () => {
    const d = applyPreset({ ...emptyDraft(now), method: 'spinning' }, spoon);
    expect(d.method).toBe('spinning');
  });

  it('Ködername danach geändert → kein Favorit mehr, keine Details', () => {
    const d = { ...applyPreset(emptyDraft(now), shad), baitName: 'Shad 10 cm' };
    const { fields } = draftToFields(d, { preset: shad });
    expect(fields?.baitPresetId).toBeUndefined();
    expect(fields?.bait).toEqual({ name: 'Shad 10 cm', type: 'softbait' });
  });

  it('Bearbeiten: Favorit gelöscht, Eintrag unverändert → Bezug und Details bleiben', () => {
    const base = {
      id: 'c1',
      ...meta,
      outcome: 'caught',
      at: '2026-10-22T09:00:00+02:00',
      tz: 'Europe/Berlin',
      bait: shad.bait,
      baitPresetId: 'p1',
    } satisfies Catch;
    const { fields } = draftToFields({ ...draftFromCatch(base), notes: 'neu' }, { base });
    expect(fields?.baitPresetId).toBe('p1');
    expect(fields?.bait).toEqual(shad.bait);
    // anderer Köder eingetragen → Details des alten Favoriten fallen weg
    const other = draftToFields(
      { ...draftFromCatch(base), baitName: 'Wobbler', baitType: 'crankbait' },
      { base },
    );
    expect(other.fields?.baitPresetId).toBeUndefined();
    expect(other.fields?.bait).toEqual({ name: 'Wobbler', type: 'crankbait' });
  });

  it('Bestandsfang ohne Favorit behält Köderfarbe aus der Alt-App', () => {
    const base = {
      id: 'c2',
      ...meta,
      outcome: 'caught',
      at: '2026-10-22T09:00:00+02:00',
      tz: 'Europe/Berlin',
      bait: { name: 'Spinner', color: 'silber' },
    } satisfies Catch;
    expect(draftToFields(draftFromCatch(base), { base }).fields?.bait).toEqual({
      name: 'Spinner',
      color: 'silber',
    });
  });
});
