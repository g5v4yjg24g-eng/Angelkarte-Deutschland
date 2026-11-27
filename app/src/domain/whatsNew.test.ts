import { describe, expect, it } from 'vitest';
import { idKey, latestId, unseenEntries } from './whatsNew';
import { CHANGELOG } from '../i18n/changelog';

const entries = [
  { id: '2026-11-02', title: 'C', items: ['c'] },
  { id: '2026-10-30-2', title: 'B2', items: ['b2'] },
  { id: '2026-10-30', title: 'B', items: ['b'] },
  { id: '2026-10-25', title: 'A', items: ['a'] },
];

describe('Neu in Fangpunkt (NEWS-1)', () => {
  it('zeigt nur, was seit dem letzten Gesehenen dazukam', () => {
    expect(unseenEntries(entries, '2026-10-30', true).map((e) => e.id)).toEqual([
      '2026-11-02',
      '2026-10-30-2',
    ]);
    expect(unseenEntries(entries, '2026-11-02', true)).toEqual([]);
  });
  it('neue Installation: kein Fenster; Bestandsnutzer ohne Stand: nur der neueste Eintrag', () => {
    expect(unseenEntries(entries, undefined, false)).toEqual([]);
    expect(unseenEntries(entries, undefined, true).map((e) => e.id)).toEqual(['2026-11-02']);
    expect(latestId(entries)).toBe('2026-11-02');
  });
  it('Zähler ab 10 gelten als neuer als -9', () => {
    const e = (id: string) => ({ id, title: id, items: ['x'] });
    const list = [e('2026-12-31-11'), e('2026-12-31-10'), e('2026-12-31-9')];
    expect(unseenEntries(list, '2026-12-31-9', true).map((x) => x.id)).toEqual(['2026-12-31-11', '2026-12-31-10']);
  });
  it('Neuigkeiten-Liste: neuester Eintrag zuerst, IDs eindeutig und im Datumsformat', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Zähler hinter dem Datum zählen als Zahl (-10 kommt nach -9)
    const key = idKey;
    expect([...ids].sort((a, b) => key(b).localeCompare(key(a)))).toEqual(ids);
    for (const e of CHANGELOG) {
      expect(e.id).toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/);
      expect(e.items.length).toBeGreaterThan(0);
    }
  });
});
