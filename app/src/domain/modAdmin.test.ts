import { describe, expect, it } from 'vitest';
import {
  BAN_DURATIONS,
  banRemaining,
  modErrorKind,
  parseModContent,
  parseModOverview,
  parseModPostState,
  parseModReporter,
  filterReports,
  reportedUsers,
  reportPriority,
  type ModReport,
  parseModLog,
  parseModReports,
  parseModUser,
  parseModUserItems,
  parseModUserRows,
  parseModWarnings,
  userQueryKind,
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
      rep({
        id: '1',
        targetUserId: 'a',
        targetName: 'Anna',
        status: 'done',
        createdAt: '2026-11-09T10:00:00Z',
      }),
      rep({ id: '2', targetUserId: 'b', targetName: 'Bert', createdAt: '2026-11-08T10:00:00Z' }),
      rep({
        id: '3',
        targetUserId: 'a',
        targetName: 'Anna',
        status: 'done',
        createdAt: '2026-11-10T10:00:00Z',
      }),
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

describe('Meldungsverwaltung (ADM-2)', () => {
  const row = (o: Record<string, unknown>) => ({
    id: 'r1',
    target_type: 'post',
    target_id: 'p1',
    reason: 'abuse',
    status: 'open',
    created_at: '2026-11-10T10:00:00Z',
    target_user: 'u1',
    open_against: 1,
    ...o,
  });

  it('neue Liste ohne meldende Person, mit Stand, Zahl zum selben Inhalt, Bearbeitung und Ausblendung', () => {
    const [a, b] = parseModReports([
      row({ status: 'in_progress', same_target: 3, handled_by_name: 'Anna', target_hidden: true }),
      row({
        id: 'r2',
        status: 'done',
        handled_at: '2026-11-10T12:00:00Z',
        reporter: 'x',
        reporter_name: 'Bert',
      }),
    ]);
    expect(a).toMatchObject({
      status: 'in_progress',
      sameTarget: 3,
      handledByName: 'Anna',
      targetHidden: true,
    });
    expect(a?.reporterId).toBeUndefined();
    expect(b).toMatchObject({ status: 'done', handledAt: '2026-11-10T12:00:00Z', reporterName: 'Bert' });
    expect(parseModReports([row({ status: 'gelöscht' })])).toEqual([]);
  });

  it('in Bearbeitung zählt als offen (Priorität, gemeldete Konten), Filter nach Art und Grund', () => {
    const list = parseModReports([
      row({ id: '1', status: 'in_progress' }),
      row({ id: '2', target_type: 'comment', reason: 'spam' }),
      row({ id: '3', reason: 'spam', status: 'done' }),
    ]);
    const first = list[0];
    if (!first) throw new Error('leer');
    expect(reportPriority(first)).toBe('high');
    expect(reportedUsers(list)[0]).toMatchObject({ reports: 3, open: 2 });
    expect(filterReports(list, { kind: 'post' }).map((x) => x.id)).toEqual(['1', '3']);
    expect(filterReports(list, { reason: 'spam' }).map((x) => x.id)).toEqual(['2', '3']);
    expect(filterReports(list, { kind: 'post', reason: 'spam' }).map((x) => x.id)).toEqual(['3']);
    expect(filterReports(list, {})).toHaveLength(3);
  });

  it('Stand eines Beitrags, meldende Person, Kennzahl „in Bearbeitung“, Fehler bei zu vielen Eingriffen', () => {
    expect(parseModPostState([{ hidden_at: '2026-11-10T10:00:00Z', hidden_reason: 'Hass' }])).toEqual({
      hiddenAt: '2026-11-10T10:00:00Z',
      hiddenReason: 'Hass',
    });
    expect(parseModPostState([{ hidden_at: null, hidden_reason: null }])).toEqual({});
    expect(parseModPostState([])).toBeUndefined();
    expect(parseModReporter([{ display_name: 'Bert', username: 'bert' }])).toEqual({
      displayName: 'Bert',
      username: 'bert',
    });
    expect(parseModOverview([{ open_reports: 2, in_progress: 1 }])?.inProgress).toBe(1);
    expect(modErrorKind(new Error('too_many_actions'))).toBe('tooMany');
  });

  it('Nutzerverwaltung: Suchart wie auf dem Server, Kontenliste, Verwarnungen, Fehler (ADM-3)', () => {
    expect(userQueryKind('  ')).toBe('empty');
    expect(userQueryKind('00000000-0000-0000-0000-0000000000C1')).toBe('id');
    expect(userQueryKind('carl@example.org')).toBe('email');
    expect(userQueryKind('@carl')).toBe('name');
    expect(userQueryKind('Carl Hecht')).toBe('name');
    expect(userQueryKind('a@b c')).toBe('name');
    expect(
      parseModUserRows([
        {
          user_id: 'u1',
          username: 'carl',
          display_name: 'Carl',
          joined: '2026-11-01T10:00:00Z',
          banned: true,
          ban_until: null,
          reports_against: 2,
          open_reports: 1,
          active_warnings: 1,
        },
        { user_id: 'kaputt' },
      ]),
    ).toEqual([
      {
        userId: 'u1',
        username: 'carl',
        displayName: 'Carl',
        joined: '2026-11-01T10:00:00Z',
        banned: true,
        banUntil: undefined,
        reportsAgainst: 2,
        openReports: 1,
        activeWarnings: 1,
      },
    ]);
    const w = parseModWarnings([
      {
        id: 'w1',
        reason: 'Beleidigung',
        created_at: '2026-11-10T10:00:00Z',
        expires_at: '2027-02-08T10:00:00Z',
        revoked_at: null,
        revoke_note: null,
        report_id: 'r1',
        post_id: null,
        moderator_name: 'Kevin',
        active: true,
      },
      { id: 'w2', reason: 'x' },
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ id: 'w1', active: true, reportId: 'r1', moderatorName: 'Kevin' });
    expect(modErrorKind(new Error('reauth_required'))).toBe('reauth');
    expect(modErrorKind(new Error('email_not_allowed'))).toBe('emailNotAllowed');
  });
});
