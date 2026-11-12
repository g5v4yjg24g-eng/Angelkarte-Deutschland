import { describe, expect, it } from 'vitest';
import {
  badgeLabel,
  hasMoreNotifications,
  isInvite,
  isOpenInvite,
  withoutNotification,
  notificationPath,
  parseNotifications,
  parseUnreadCount,
  shouldDismissRight,
  splitNew,
  timeAgo,
  type AppNotification,
} from './notifications';

const base = {
  id: 'n1',
  kind: 'like',
  actor_id: 'u2',
  actor_username: 'bert',
  actor_display_name: 'Bert',
  ref: 'p1',
  excerpt: null,
  created_at: '2026-11-11T10:00:00Z',
  is_read: false,
  post_author_username: 'anna',
  post_created_at: '2026-11-01T10:00:00Z',
  post_is_mine: true,
};

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  kind: 'like',
  actorId: 'u2',
  username: 'bert',
  displayName: 'Bert',
  ref: 'p1',
  createdAt: '2026-11-11T10:00:00Z',
  read: false,
  ...over,
});

describe('parseNotifications', () => {
  it('liest Zeilen und überspringt unbekannte Arten und kaputte Zeilen', () => {
    const list = parseNotifications([base, { ...base, id: 'n2', kind: 'zukunft' }, { id: 'x' }, null]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'n1', kind: 'like', username: 'bert', read: false });
    expect(list[0]?.post).toEqual({ authorUsername: 'anna', createdAt: '2026-11-01T10:00:00Z', mine: true });
  });
  it('ohne sichtbaren Beitrag kein post', () => {
    const [x] = parseNotifications([
      { ...base, post_author_username: null, post_created_at: null, post_is_mine: null },
    ]);
    expect(x?.post).toBeUndefined();
  });
  it('null oder leer ergibt eine leere Liste', () => {
    expect(parseNotifications(null)).toEqual([]);
    expect(parseNotifications(undefined)).toEqual([]);
  });
});

describe('badgeLabel', () => {
  it('nichts bei 0, Zahl bis 9, ab 10 „9+“', () => {
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(-3)).toBeUndefined();
    expect(badgeLabel(NaN)).toBeUndefined();
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(9)).toBe('9');
    expect(badgeLabel(10)).toBe('9+');
    expect(badgeLabel(100)).toBe('9+');
  });
});

describe('parseUnreadCount', () => {
  it('nimmt nur ganze Zahlen ab 0', () => {
    expect(parseUnreadCount(4)).toBe(4);
    expect(parseUnreadCount('7')).toBe(7);
    expect(parseUnreadCount(null)).toBe(0);
    expect(parseUnreadCount('x')).toBe(0);
    expect(parseUnreadCount(-2)).toBe(0);
  });
});

describe('notificationPath', () => {
  it('eigener Beitrag → Beitragsseite', () => {
    expect(notificationPath(n({ post: { authorUsername: 'anna', createdAt: 't', mine: true } }))).toBe(
      '/profil/beitrag/p1',
    );
  });
  it('fremder Beitrag → Beiträge der Person ab diesem Beitrag', () => {
    expect(
      notificationPath(
        n({
          kind: 'comment_reply',
          post: { authorUsername: 'anna', createdAt: '2026-11-01T10:00:00Z', mine: false },
        }),
      ),
    ).toBe('/profil/nutzer/anna/beitraege?ab=2026-11-01T10%3A00%3A00Z');
  });
  it('Beitrag nicht sichtbar → kein Ziel', () => {
    expect(notificationPath(n({ kind: 'comment' }))).toBeUndefined();
    expect(
      notificationPath(n({ post: { authorUsername: 'anna', createdAt: 't', mine: true }, ref: undefined })),
    ).toBeUndefined();
  });
  it('Folgen, Einladungen, Sessions, Spots', () => {
    expect(notificationPath(n({ kind: 'new_follower' }))).toBe('/profil/nutzer/bert');
    expect(notificationPath(n({ kind: 'friend_accepted' }))).toBe('/profil/nutzer/bert');
    expect(notificationPath(n({ kind: 'friend_request' }))).toBe('/profil/freunde');
    expect(notificationPath(n({ kind: 'spot' }))).toBe('/profil/spots');
    expect(notificationPath(n({ kind: 'session_invite' }))).toBe('/fangbuch/sessions');
    expect(notificationPath(n({ kind: 'session_joined' }))).toBe('/fangbuch/sessions');
    expect(notificationPath(n({ kind: 'session_highlight' }))).toBe('/fangbuch/sessions');
    expect(notificationPath(n({ kind: 'trip_start' }))).toBe('/fangbuch/sessions');
    expect(notificationPath(n({ kind: 'trip_invite' }))).toBe('/wetter/kalender');
  });
  it('Nutzername im Pfad wird kodiert', () => {
    expect(notificationPath(n({ kind: 'new_follower', username: 'a.b_c' }))).toBe('/profil/nutzer/a.b_c');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  it('Minuten, Stunden, Tage, Datum', () => {
    expect(timeAgo('2026-11-11T11:59:50Z', now)).toBe('gerade eben');
    expect(timeAgo('2026-11-11T11:55:00Z', now)).toBe('vor 5 Min.');
    expect(timeAgo('2026-11-11T09:00:00Z', now)).toBe('vor 3 Std.');
    expect(timeAgo('2026-11-10T11:00:00Z', now)).toBe('gestern');
    expect(timeAgo('2026-11-08T12:00:00Z', now)).toBe('vor 3 Tagen');
    expect(timeAgo('2026-10-20T12:00:00Z', now)).toMatch(/20\.\s*Okt/);
    expect(timeAgo('kaputt', now)).toBe('');
  });
  it('Zukunft (Uhrabweichung) zeigt „gerade eben“', () => {
    expect(timeAgo('2026-11-11T12:05:00Z', now)).toBe('gerade eben');
  });
});

describe('splitNew / hasMore', () => {
  it('trennt ungelesene von gelesenen', () => {
    const { fresh, earlier } = splitNew([
      n({ id: 'a', read: false }),
      n({ id: 'b', read: true }),
      n({ id: 'c', read: false }),
    ]);
    expect(fresh.map((x) => x.id)).toEqual(['a', 'c']);
    expect(earlier.map((x) => x.id)).toEqual(['b']);
  });
  it('weitere nur bei voller Seite', () => {
    expect(hasMoreNotifications(30)).toBe(true);
    expect(hasMoreNotifications(29)).toBe(false);
  });
});

describe('shouldDismissRight', () => {
  it('weit genug oder schnell nach rechts', () => {
    expect(shouldDismissRight(120, 500, 390)).toBe(true);
    expect(shouldDismissRight(50, 80, 390)).toBe(true);
    expect(shouldDismissRight(50, 800, 390)).toBe(false);
    expect(shouldDismissRight(10, 5, 390)).toBe(false);
  });
  it('nach links oder ohne Breite nie', () => {
    expect(shouldDismissRight(-200, 100, 390)).toBe(false);
    expect(shouldDismissRight(200, 100, 0)).toBe(false);
  });
});

describe('Einladungen und Löschen', () => {
  it('liest die Angaben zur Termin- und Session-Einladung', () => {
    const [t, s] = parseNotifications([
      {
        ...base,
        kind: 'trip_invite',
        ref: 'trip-1',
        post_author_username: null,
        post_created_at: null,
        post_is_mine: null,
        invite_status: 'invited',
        trip_title: 'Abendansitz',
        trip_water_name: 'De Wittsee',
        trip_date: '2099-05-17',
        trip_from: '17:00',
        trip_to: '21:00',
        trip_tz: 'Europe/Berlin',
      },
      {
        ...base,
        id: 'n2',
        kind: 'trip_start',
        ref: 'g1',
        invite_status: 'accepted',
        session_title: 'De Wittsee',
      },
    ]);
    expect(t?.trip).toEqual({
      title: 'Abendansitz',
      waterName: 'De Wittsee',
      date: '2099-05-17',
      from: '17:00',
      to: '21:00',
      tz: 'Europe/Berlin',
    });
    expect(t?.inviteStatus).toBe('invited');
    expect(s?.sessionTitle).toBe('De Wittsee');
    expect(s?.trip).toBeUndefined();
  });
  it('Termin ohne Tag aus dem Server hat keine Angaben', () => {
    const [t] = parseNotifications([{ ...base, kind: 'trip_invite', invite_status: 'invited' }]);
    expect(t?.trip).toBeUndefined();
  });
  it('offen = Einladung, auf die noch nicht geantwortet wurde', () => {
    expect(isInvite(n({ kind: 'trip_invite' }))).toBe(true);
    expect(isInvite(n({ kind: 'session_invite' }))).toBe(true);
    expect(isInvite(n({ kind: 'trip_start' }))).toBe(true);
    expect(isInvite(n({ kind: 'like' }))).toBe(false);
    expect(isOpenInvite(n({ kind: 'trip_invite', inviteStatus: 'invited' }))).toBe(true);
    expect(isOpenInvite(n({ kind: 'trip_invite' }))).toBe(true);
    expect(isOpenInvite(n({ kind: 'trip_invite', inviteStatus: 'accepted' }))).toBe(false);
    expect(isOpenInvite(n({ kind: 'trip_start', inviteStatus: 'declined' }))).toBe(false);
    expect(isOpenInvite(n({ kind: 'like' }))).toBe(false);
  });
  it('withoutNotification nimmt nur die gewählte heraus', () => {
    const list = [n({ id: 'a' }), n({ id: 'b' }), n({ id: 'c' })];
    expect(withoutNotification(list, 'b').map((x) => x.id)).toEqual(['a', 'c']);
    expect(withoutNotification(list, 'x')).toHaveLength(3);
  });
});

describe('Spot-Angebote in den Mitteilungen (SPOT-6)', () => {
  it('Angebot zählt als Einladung, bestätigt nicht; Ziel ist die Spot-Seite', () => {
    expect(isInvite({ kind: 'spot_link' })).toBe(true);
    expect(isInvite({ kind: 'spot_link_accepted' })).toBe(false);
    expect(isOpenInvite(n({ kind: 'spot_link', inviteStatus: 'invited' }))).toBe(true);
    expect(isOpenInvite(n({ kind: 'spot_link', inviteStatus: 'accepted' }))).toBe(false);
    expect(notificationPath(n({ kind: 'spot_link' }))).toBe('/profil/spots');
    expect(notificationPath(n({ kind: 'spot_link_accepted' }))).toBe('/profil/spots');
  });
  it('liest die neuen Arten', () => {
    const list = parseNotifications([
      { ...base, id: 'a', kind: 'spot_link', invite_status: 'invited' },
      { ...base, id: 'b', kind: 'spot_link_accepted' },
    ]);
    expect(list.map((x) => x.kind)).toEqual(['spot_link', 'spot_link_accepted']);
    expect(list[0]?.inviteStatus).toBe('invited');
  });
});
