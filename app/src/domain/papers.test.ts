import { describe, expect, it } from 'vitest';
import type { Paper } from './schemas';
import {
  MAX_PENDING_REMINDERS,
  daysBetween,
  emptyPaperDraft,
  localToday,
  needAttention,
  paperDraftToFields,
  paperState,
  reminderPlan,
  renewIssue,
  sortPapers,
} from './papers';

const base = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', rev: 0 };
const paper = (id: string, extra: Partial<Paper> = {}): Paper => ({
  ...base,
  id,
  kind: 'permit',
  title: `Papier ${id}`,
  ...extra,
});
const texts = {
  title: (p: Paper) => `Ablauf: ${p.title}`,
  body: (_p: Paper, d: number) => `in ${d} Tagen`,
};

describe('Datumsrechnung', () => {
  it('zählt Tage über Monats- und Jahresgrenzen', () => {
    expect(daysBetween('2026-11-16', '2026-12-16')).toBe(30);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-16', '2026-11-10')).toBe(-6);
  });
  it('Sommerzeitwechsel verfälscht die Tage nicht', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('localToday nutzt die Ortszeit', () => {
    expect(localToday(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
  });
});

describe('paperState', () => {
  const today = '2026-11-16';
  it('ohne Ablaufdatum unbefristet', () => expect(paperState({}, today)).toEqual({ kind: 'unlimited' }));
  it('gültig, bald und abgelaufen', () => {
    expect(paperState({ validUntil: '2027-03-01' }, today)).toMatchObject({ kind: 'valid' });
    expect(paperState({ validUntil: '2026-12-16' }, today)).toEqual({ kind: 'soon', days: 30 });
    expect(paperState({ validUntil: '2026-11-16' }, today)).toEqual({ kind: 'soon', days: 0 });
    expect(paperState({ validUntil: '2026-11-15' }, today)).toEqual({ kind: 'expired', days: 1 });
  });
  it('noch nicht gültig', () => {
    expect(paperState({ validFrom: '2027-01-01', validUntil: '2027-12-31' }, today)).toMatchObject({
      kind: 'notYet',
    });
  });
});

describe('Sortierung und Aufmerksamkeit', () => {
  const today = '2026-11-16';
  const list = [
    paper('a', { validUntil: '2027-06-01' }),
    paper('b', { validUntil: '2026-11-01' }),
    paper('c'),
    paper('d', { validUntil: '2026-11-30' }),
    paper('x', { validUntil: '2026-11-20', deletedAt: '2026-11-01T00:00:00Z' }),
  ];
  it('abgelaufen, bald, gültig, unbefristet; Gelöschte fehlen', () => {
    expect(sortPapers(list, today).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('needAttention: abgelaufen und bald', () => {
    expect(needAttention(list, today).map((p) => p.id)).toEqual(['b', 'd']);
  });
});

describe('reminderPlan', () => {
  const p = paper('p', { validUntil: '2026-12-20' });
  const now = new Date(2026, 10, 16, 12, 0).getTime();
  it('plant 30/14/7/1/0 Tage vorher um 9 Uhr, nur Zukünftiges', () => {
    const r = reminderPlan([p], now, texts);
    // 30 Tage vorher = 20.11. 09:00 (liegt nach „jetzt“), alle fünf stehen an
    expect(r.map((x) => new Date(x.at).getDate())).toEqual([20, 6, 13, 19, 20]);
    expect(r).toHaveLength(5);
    expect(new Date(r[0]?.at ?? 0).getHours()).toBe(9);
    expect(r.map((x) => x.id)).toEqual(['paper.p.30', 'paper.p.14', 'paper.p.7', 'paper.p.1', 'paper.p.0']);
    expect(r[4]).toMatchObject({ title: 'Ablauf: Papier p', body: 'in 0 Tagen' });
  });
  it('lässt Vergangenes aus', () => {
    const late = new Date(2026, 11, 15, 12, 0).getTime();
    expect(reminderPlan([p], late, texts).map((x) => x.id)).toEqual(['paper.p.1', 'paper.p.0']);
  });
  it('ohne Ablaufdatum, ausgeschaltet oder gelöscht: nichts', () => {
    expect(reminderPlan([paper('u')], now, texts)).toEqual([]);
    expect(reminderPlan([paper('o', { validUntil: '2027-01-01', remind: false })], now, texts)).toEqual([]);
    expect(
      reminderPlan([paper('g', { validUntil: '2027-01-01', deletedAt: '2026-11-01T00:00:00Z' })], now, texts),
    ).toEqual([]);
  });
  it('begrenzt auf die frühesten', () => {
    const many = Array.from({ length: 20 }, (_, i) => paper(`m${i}`, { validUntil: '2027-05-01' }));
    expect(reminderPlan(many, now, texts)).toHaveLength(MAX_PENDING_REMINDERS);
    expect(reminderPlan(many, now, texts, 3)).toHaveLength(3);
  });
  it('Monatsgrenze: 30 Tage vor dem 10.12. ist der 10.11.', () => {
    const r = reminderPlan(
      [paper('q', { validUntil: '2026-12-10' })],
      new Date(2026, 10, 1).getTime(),
      texts,
    );
    const d = new Date(r[0]?.at ?? 0);
    expect([d.getMonth() + 1, d.getDate()]).toEqual([11, 10]);
  });
});

describe('Verlängern', () => {
  it('nur ein späteres, gültiges Datum', () => {
    const p = { validUntil: '2026-12-31' };
    expect(renewIssue(p, '2027-12-31')).toBeUndefined();
    expect(renewIssue(p, '2026-12-31')).toBe('notLater');
    expect(renewIssue(p, '')).toBe('invalid');
    expect(renewIssue({}, '2027-01-01')).toBeUndefined();
  });
});

describe('Formular', () => {
  it('Titel Pflicht, Fischereischein standardmäßig unbefristet', () => {
    expect(emptyPaperDraft('license').unlimited).toBe(true);
    expect(emptyPaperDraft('permit').unlimited).toBe(false);
    expect(paperDraftToFields({ ...emptyPaperDraft('license'), title: ' ' }).errors.title).toBe('required');
  });
  it('befristet braucht ein Ablaufdatum, in der richtigen Reihenfolge', () => {
    const d = { ...emptyPaperDraft('permit'), title: 'Jahreskarte' };
    expect(paperDraftToFields(d).errors.validUntil).toBe('dateMissing');
    expect(
      paperDraftToFields({ ...d, validFrom: '2026-05-01', validUntil: '2026-01-01' }).errors.validUntil,
    ).toBe('dateOrder');
    const ok = paperDraftToFields({ ...d, title: ' Jahreskarte ', validUntil: '2026-12-31', number: ' 12 ' });
    expect(ok.fields).toMatchObject({
      title: 'Jahreskarte',
      validUntil: '2026-12-31',
      number: '12',
      remind: true,
    });
  });
  it('unbefristet verwirft ein eingetragenes Ablaufdatum', () => {
    const r = paperDraftToFields({
      ...emptyPaperDraft('license'),
      title: 'Schein',
      validUntil: '2030-01-01',
    });
    expect(r.fields?.validUntil).toBeUndefined();
  });
});
