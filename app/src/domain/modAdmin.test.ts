import { describe, expect, it } from 'vitest';
import {
  BAN_DURATIONS,
  banRemaining,
  modErrorKind,
  parseModContent,
  parseModOverview,
  reportedUsers,
  reportPriority,
  type ModReport,
  parseModLog,
  parseModReports,
  parseModUser,
  parseModUserItems,
} from './modAdmin';

describe('Moderationsbereich (MODA-1)', () => {
  it('liest Meldungen; kaputte Zeilen fallen weg', () => {
    const list = parseModReports([
      {
        id: 'r1',
        target_type: 'comment',
        target_id: 'c1',
        reason: 'spam',
        details: null,
        status: 'open',
        created_at: '2026-11-05T10:00:00Z',
        reporter: 'u1',
        reporter_name: 'Kevin',
        target_user: 'u2',
        target_name: 'Anna',
        target_username: 'anna',
        target_banned: false,
        open_against: 2,
      },
      { id: 'kaputt' },
    ]);
    expect(list).toEqual([
      expect.objectContaining({
        id: 'r1',
        kind: 'comment',
        details: undefined,
        targetName: 'Anna',
        openAgainst: 2,
      }),
    ]);
  });

  it('Inhalt, Konto, Inhalte und Protokoll; fehlender Inhalt = undefined', () => {
    expect(parseModContent([])).toBeUndefined();
    expect(
      parseModContent([
        {
          author: 'u2',
          body: 'Text',
          photo_paths: ['u2/p/1.jpg'],
          post_id: 'p',
          extra: 'friends',
          created_at: 'x',
        },
      ]),
    ).toEqual({
      authorId: 'u2',
      body: 'Text',
      photoPaths: ['u2/p/1.jpg'],
      postId: 'p',
      extra: 'friends',
      createdAt: 'x',
    });
    expect(
      parseModUser([
        {
          user_id: 'u2',
          username: 'anna',
          display_name: 'Anna',
          banned: true,
          ban_until: null,
          ban_reason: 'Spam',
          posts: 1,
          comments: 2,
          spots: 0,
          reports_against: 3,
          joined: '2026-11-01T00:00:00Z',
        },
      ]),
    ).toMatchObject({ banned: true, banUntil: undefined, banReason: 'Spam', reportsAgainst: 3 });
    expect(
      parseModUserItems([
        { kind: 'spot', id: 's', body: 'Buhne', photo_paths: null, post_id: null, created_at: 'y' },
      ]),
    ).toEqual([{ kind: 'spot', id: 's', body: 'Buhne', photoPaths: [], postId: undefined, createdAt: 'y' }]);
    expect(
      parseModLog([{ action: 'ban', detail: '7 Tage: Spam', created_at: 'z', moderator_name: 'Kevin' }]),
    ).toEqual([{ action: 'ban', detail: '7 Tage: Spam', createdAt: 'z', moderatorName: 'Kevin' }]);
  });

  it('Sperrdauer: 1, 7, 30 Tage oder dauerhaft; Restzeit in Tagen und Stunden', () => {
    expect(BAN_DURATIONS).toEqual([1, 7, 30, null]);
    const now = Date.parse('2026-11-05T10:00:00Z');
    expect(banRemaining(undefined, now)).toBeUndefined();
    expect(banRemaining('2026-11-07T13:00:00Z', now)).toEqual({ days: 2, hours: 3 });
    expect(banRemaining('2026-11-01T00:00:00Z', now)).toEqual({ days: 0, hours: 0 });
  });

  it('ordnet Server-Fehler zu', () => {
    expect(modErrorKind(new Error('not_moderator'))).toBe('notModerator');
    expect(modErrorKind(new Error('self'))).toBe('self');
    expect(modErrorKind(new Error('not_banned'))).toBe('notFound');
    expect(modErrorKind(new Error('no_reason'))).toBe('noReason');
    expect(modErrorKind(undefined)).toBe('unknown');
  });
});

describe('Admin-Bereich, Übersicht (ADM-1)', () => {
  const rep = (o: Partial<ModReport>): ModReport => ({
    id: 'r',
    kind: 'post',
    targetId: 't',
    reason: 'spam',
    status: 'open',
    createdAt: '2026-11-10T10:00:00Z',
    reporterId: 'x',
    targetBanned: false,
    openAgainst: 1,
    ...o,
  });

  it('Kennzahlen nur aus echten Werten; fehlende bleiben leer', () => {
    expect(parseModOverview([{ open_reports: 3, done_today: 2, banned_now: 1, new_users_7d: 7 }])).toEqual({
      openReports: 3,
      doneToday: 2,
      bannedNow: 1,
      newUsers7d: 7,
    });
    const o = parseModOverview([{ open_reports: 0 }]);
    expect(o).toEqual({ openReports: 0, doneToday: undefined, bannedNow: undefined, newUsers7d: undefined });
    expect(o?.inProgress).toBeUndefined();
    expect(o?.openAppeals).toBeUndefined();
    expect(parseModOverview([{ open_reports: -1 }])).toBeUndefined();
    expect(parseModOverview([])).toBeUndefined();
    expect(parseModOverview(null)).toBeUndefined();
  });

  it('Priorität nur als Hinweis: schwerer Grund oder mehrere offene Meldungen', () => {
    expect(reportPriority(rep({ reason: 'abuse' }))).toBe('high');
    expect(reportPriority(rep({ reason: 'spam', openAgainst: 3 }))).toBe('high');
    expect(reportPriority(rep({ reason: 'privacy' }))).toBe('mid');
    expect(reportPriority(rep({ reason: 'spam', openAgainst: 2 }))).toBe('mid');
    expect(reportPriority(rep({ reason: 'spam' }))).toBe('low');
    expect(reportPriority(rep({ reason: 'violence', status: 'done' }))).toBe('low');
  });

  it('gemeldete Konten: je Person zusammengefasst, offene zuerst, dann neueste', () => {
    const list = reportedUsers([
      rep({ id: '1', targetUserId: 'a', targetName: 'Anna', status: 'done', createdAt: '2026-11-09T10:00:00Z' }),
      rep({ id: '2', targetUserId: 'b', targetName: 'Bert', createdAt: '2026-11-08T10:00:00Z' }),
      rep({ id: '3', targetUserId: 'a', targetName: 'Anna', status: 'done', createdAt: '2026-11-10T10:00:00Z' }),
      rep({ id: '4' }), // ohne Person (z. B. gelöschtes Konto)
      rep({ id: '5', targetUserId: 'c', targetBanned: true, createdAt: '2026-11-07T10:00:00Z' }),
    ]);
    expect(list.map((u) => [u.userId, u.reports, u.open])).toEqual([
      ['b', 1, 1],
      ['c', 1, 1],
      ['a', 2, 0],
    ]);
    expect(list[1]?.banned).toBe(true);
    expect(list[2]?.last).toBe('2026-11-10T10:00:00Z');
  });
});
