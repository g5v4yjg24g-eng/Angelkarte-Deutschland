import { describe, expect, it } from 'vitest';
import { appealBodyIssue, appealErrorKind, appealToken, parseAppealInfo, parseModAppeals } from './appeals';

const TOKEN = 'a'.repeat(64);

describe('Einsprüche (APL-1)', () => {
  it('Schlüssel nur in der erwarteten Form aus der Adresse', () => {
    expect(appealToken(`?t=${TOKEN}`)).toBe(TOKEN);
    expect(appealToken(`?x=1&t=${TOKEN}`)).toBe(TOKEN);
    expect(appealToken('?t=abc')).toBeUndefined();
    expect(appealToken(`?t=${'G'.repeat(64)}`)).toBeUndefined();
    expect(appealToken('')).toBeUndefined();
  });

  it('Begründung 10–2000 Zeichen, Leerraum zählt nicht', () => {
    expect(appealBodyIssue('  kurz   ')).toBe('short');
    expect(appealBodyIssue('Das war ein Irrtum.')).toBeUndefined();
    expect(appealBodyIssue('x'.repeat(2001))).toBe('long');
  });

  it('Stand des Links und Liste lesen, Kaputtes fällt weg', () => {
    expect(
      parseAppealInfo([{ state: 'open', ban_until: null, ban_reason: 'Spam', appeal_status: null }]),
    ).toEqual({
      state: 'open',
      banUntil: undefined,
      banReason: 'Spam',
      appealStatus: undefined,
    });
    expect(parseAppealInfo([{ state: 'used', appeal_status: 'rejected' }])).toMatchObject({
      appealStatus: 'rejected',
    });
    expect(parseAppealInfo([])).toEqual({ state: 'invalid' });
    expect(parseAppealInfo([{ state: 'egal' }])).toEqual({ state: 'invalid' });
    const list = parseModAppeals([
      {
        id: 'a1',
        user_id: 'u1',
        username: 'carl',
        display_name: 'Carl',
        body: 'Irrtum!',
        status: 'open',
        created_at: '2026-11-10T10:00:00Z',
        banned: true,
        ban_until: null,
        ban_reason: 'Hass',
      },
      { id: 'a2', status: 'vielleicht' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'a1', banned: true, banReason: 'Hass', status: 'open' });
  });

  it('Fehler vom Server', () => {
    expect(appealErrorKind(new Error('invalid_token'))).toBe('invalid');
    expect(appealErrorKind(new Error('already_used'))).toBe('used');
    expect(appealErrorKind(new Error('not_banned'))).toBe('ended');
    expect(appealErrorKind(new Error('too_short'))).toBe('short');
    expect(appealErrorKind(new Error('Failed to fetch'))).toBe('offline');
    expect(appealErrorKind(undefined)).toBe('unknown');
  });
});
