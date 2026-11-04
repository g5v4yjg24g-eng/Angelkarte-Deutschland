import { describe, expect, it } from 'vitest';
import {
  hiddenKey,
  isHidden,
  moderationErrorKind,
  needsRulesConsent,
  parseBlockRows,
  parseHidden,
  reportInput,
  REPORT_REASONS,
  RULES_VERSION,
} from './moderation';

describe('Melden und Blockieren (MOD-1)', () => {
  it('Meldung: Hinweis gekürzt und ohne Leerzeichen, leer fällt weg', () => {
    expect(reportInput('post', 'p1', 'u2', 'spam', '  ')).toEqual({
      kind: 'post',
      targetId: 'p1',
      targetUserId: 'u2',
      reason: 'spam',
    });
    expect(reportInput('user', 'u2', 'u2', 'abuse', ` ${'x'.repeat(1200)} `).details).toHaveLength(1000);
    expect(REPORT_REASONS).toEqual(['spam', 'abuse', 'nudity', 'violence', 'privacy', 'other']);
  });

  it('liest blockierte Konten; kaputte Zeilen fallen weg', () => {
    expect(
      parseBlockRows([{ user_id: 'u2', username: 'anna', display_name: 'Anna', since: 'x' }, { user_id: 1 }]),
    ).toEqual([{ userId: 'u2', username: 'anna', displayName: 'Anna' }]);
    expect(parseBlockRows(null)).toEqual([]);
  });

  it('blendet gemeldete Inhalte und alles von gemeldeten/blockierten Konten aus', () => {
    const hidden = parseHidden(JSON.stringify([hiddenKey('post', 'p1'), hiddenKey('user', 'u9'), 3]));
    expect(isHidden(hidden, 'post', 'p1', 'u2')).toBe(true);
    expect(isHidden(hidden, 'post', 'p2', 'u2')).toBe(false);
    expect(isHidden(hidden, 'spot', 's1', 'u9')).toBe(true);
    expect(parseHidden('kaputt').size).toBe(0);
    expect(parseHidden(null).size).toBe(0);
  });

  it('fragt nach den Regeln, solange die aktuelle Version nicht bestätigt ist', () => {
    expect(needsRulesConsent(null)).toBe(true);
    expect(needsRulesConsent(String(RULES_VERSION - 1))).toBe(true);
    expect(needsRulesConsent(String(RULES_VERSION))).toBe(false);
    expect(needsRulesConsent('abc')).toBe(true);
  });

  it('ordnet Server-Fehler zu', () => {
    expect(moderationErrorKind(new Error('too_many'))).toBe('tooMany');
    expect(moderationErrorKind({ message: 'x', status: 401 })).toBe('notSignedIn');
    expect(moderationErrorKind(new Error('Failed to fetch'))).toBe('offline');
    expect(moderationErrorKind(undefined)).toBe('unknown');
  });
});
