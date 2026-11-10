import { describe, expect, it } from 'vitest';
import {
  blockedPatternIssue,
  interventions,
  nameMatches,
  parseBlockedNames,
  parseModLogItems,
  parseModRole,
  parseModRoles,
  parseModStats,
  toBars,
  usernameKey,
} from './modTools';

describe('Admin-Verwaltung (ADM-4)', () => {
  it('gesperrte Nutzernamen: Schlüssel und Treffer wie auf dem Server', () => {
    expect(usernameKey(' H.a_SS ')).toBe('hass');
    expect(blockedPatternIssue('a')).toBe('short');
    expect(blockedPatternIssue('x'.repeat(31))).toBe('long');
    expect(blockedPatternIssue('hä')).toBe('chars');
    expect(blockedPatternIssue('h.a_ss')).toBeUndefined();
    expect(nameMatches('hass.angler', { pattern: 'hass', kind: 'contains' })).toBe(true);
    expect(nameMatches('h_a.s.s', { pattern: 'hass', kind: 'exact' })).toBe(true);
    expect(nameMatches('kevin2', { pattern: 'kevin', kind: 'exact' })).toBe(false);
    expect(
      parseBlockedNames([
        {
          pattern: 'hass',
          kind: 'contains',
          note: null,
          created_at: '2026-11-10T10:00:00Z',
          moderator_name: 'Kevin',
          matches: 1,
        },
        { pattern: 'x', kind: 'teilweise' },
      ]),
    ).toEqual([
      {
        pattern: 'hass',
        kind: 'contains',
        note: undefined,
        createdAt: '2026-11-10T10:00:00Z',
        moderatorName: 'Kevin',
        matches: 1,
      },
    ]);
  });

  it('Rollen und Protokoll lesen, Kaputtes auslassen', () => {
    expect(parseModRole('founder')).toBe('founder');
    expect(parseModRole('admin')).toBeUndefined();
    expect(
      parseModRoles([
        { user_id: 'u1', role: 'moderator', since: '2026-11-01T00:00:00Z' },
        { user_id: 'u2', role: 'chef' },
      ]),
    ).toHaveLength(1);
    const log = parseModLogItems([
      {
        id: 'l1',
        action: 'ban',
        detail: '7 Tage: Spam',
        created_at: '2026-11-10T10:00:00Z',
        moderator_name: 'Kevin',
        target_user: 'u2',
        target_name: 'Otto',
        target_username: 'otto',
        report_id: null,
      },
      { id: 'l2' },
    ]);
    expect(log).toEqual([
      {
        id: 'l1',
        action: 'ban',
        detail: '7 Tage: Spam',
        createdAt: '2026-11-10T10:00:00Z',
        moderatorName: 'Kevin',
        targetUserId: 'u2',
        targetName: 'Otto',
        targetUsername: 'otto',
        reportId: undefined,
      },
    ]);
  });

  it('Statistik: nur gültige Zahlen, Balken größte zuerst, Eingriffe gezählt', () => {
    const s = parseModStats({
      days: 30,
      reports: 3,
      reports_done: 2,
      by_reason: { abuse: 2, spam: 1 },
      by_kind: { post: 1, user: 2 },
      median_hours: 3,
      actions: { warn: 1, ban: 2, resolve: 2, view_reporter: 4 },
      new_users: 4,
      banned_now: 1,
      warned_now: 0,
      weeks: [{ week: '2026-11-02', reports: 1, new_users: 2 }],
    });
    expect(s).toMatchObject({ reports: 3, medianHours: 3, weeks: [{ week: '2026-11-02', newUsers: 2 }] });
    expect(parseModStats({ days: 30 })).toBeUndefined();
    expect(parseModStats({ ...s, reports: -1 })).toBeUndefined();
    expect(toBars({ spam: 1, abuse: 2, other: 0, nudity: 2 })).toEqual([
      { key: 'abuse', value: 2, share: 1 },
      { key: 'nudity', value: 2, share: 1 },
      { key: 'spam', value: 1, share: 0.5 },
    ]);
    expect(toBars({})).toEqual([]);
    expect(interventions({ warn: 1, ban: 2, resolve: 2, view_reporter: 4, hide_post: 1 })).toBe(4);
  });
});
