import { describe, expect, it } from 'vitest';
import {
  cleanDraft,
  draftIssue,
  moveItem,
  needsConsentFor,
  newerRules,
  parseCurrentRules,
  parseRulesHistory,
  parseStoredRules,
  storeRules,
  type CommunityRules,
} from './communityRules';
import { needsRulesConsent } from './moderation';

const v1: CommunityRules = {
  version: 1,
  intro: 'Einleitung',
  items: ['A', 'B'],
  publishedAt: '2026-11-03T00:00:00Z',
};

describe('Community-Regeln mit Versionen (RUL-1)', () => {
  it('liest die aktuelle Fassung und den Verlauf, Kaputtes fällt weg', () => {
    expect(
      parseCurrentRules([
        { version: 2, intro: 'X', items: ['a'], summary: 'neu', published_at: '2026-11-10T10:00:00Z' },
      ]),
    ).toEqual({ version: 2, intro: 'X', items: ['a'], summary: 'neu', publishedAt: '2026-11-10T10:00:00Z' });
    expect(parseCurrentRules([{ version: 0, intro: 'X', items: ['a'], published_at: 'x' }])).toBeUndefined();
    expect(parseCurrentRules([])).toBeUndefined();
    const h = parseRulesHistory([
      {
        version: 1,
        intro: 'E',
        items: ['A'],
        summary: null,
        published_at: '2026-11-03T00:00:00Z',
        publisher_name: null,
        consents: 3,
        accounts: 5,
      },
      {
        version: 2,
        intro: 'E',
        items: ['A', 'B'],
        summary: 'B neu',
        published_at: '2026-11-10T00:00:00Z',
        publisher_name: 'Kevin',
        consents: 1,
        accounts: 5,
      },
      { version: 3 },
    ]);
    expect(h.map((x) => x.version)).toEqual([2, 1]);
    expect(h[0]).toMatchObject({ publisherName: 'Kevin', consents: 1, accounts: 5, summary: 'B neu' });
  });

  it('Gerätespeicher: speichern und lesen, neuere Fassung gewinnt', () => {
    expect(parseStoredRules(storeRules(v1))).toEqual(v1);
    expect(parseStoredRules('{kaputt')).toBeUndefined();
    expect(parseStoredRules(null)).toBeUndefined();
    const v2 = { ...v1, version: 2 };
    expect(newerRules(v2, v1)).toBe(v2);
    expect(newerRules(undefined, v1)).toBe(v1);
    expect(newerRules({ ...v1, version: 1, intro: 'alt' }, v1)).toBe(v1);
  });

  it('Zustimmung: nur bei höherer Fassung erneut', () => {
    expect(needsConsentFor(undefined, 1)).toBe(true);
    expect(needsConsentFor(0, 1)).toBe(true);
    expect(needsConsentFor(1, 2)).toBe(true);
    expect(needsConsentFor(2, 2)).toBe(false);
    expect(needsRulesConsent('1', 2)).toBe(true);
    expect(needsRulesConsent('2', 2)).toBe(false);
  });

  it('Entwurf prüfen wie der Server: leer, zu viele, zu lang, unverändert, ohne Änderungsgrund', () => {
    expect(cleanDraft({ intro: ' E ', items: [' A ', '', '  '], summary: ' s ' })).toEqual({
      intro: 'E',
      items: ['A'],
      summary: 's',
    });
    expect(draftIssue({ intro: '', items: ['A'], summary: 's' })).toBe('empty');
    expect(draftIssue({ intro: 'E', items: [' '], summary: 's' })).toBe('empty');
    expect(draftIssue({ intro: 'E', items: Array.from({ length: 16 }, () => 'x'), summary: 's' })).toBe(
      'tooMany',
    );
    expect(draftIssue({ intro: 'E', items: ['x'.repeat(501)], summary: 's' })).toBe('tooLong');
    expect(draftIssue({ intro: 'Einleitung', items: ['A', 'B', ''], summary: 's' }, v1)).toBe('unchanged');
    expect(draftIssue({ intro: 'Einleitung', items: ['A', 'B', 'C'], summary: ' ' }, v1)).toBe('noSummary');
    expect(draftIssue({ intro: 'Einleitung', items: ['A', 'B', 'C'], summary: 'x'.repeat(301) }, v1)).toBe(
      'tooLong',
    );
    expect(
      draftIssue({ intro: 'Einleitung', items: ['B', 'A'], summary: 'Reihenfolge' }, v1),
    ).toBeUndefined();
  });

  it('Regeln verschieben', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
