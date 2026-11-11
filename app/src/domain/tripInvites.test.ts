import { describe, expect, it } from 'vitest';
import {
  invitedWithReplies,
  missingAccepted,
  openInvites,
  parseTripInvites,
  parseTripReplies,
  tripFromInvite,
  unsentInvitees,
  type TripInvite,
} from './tripInvites';

const invite = (o: Partial<TripInvite> = {}): TripInvite => ({
  tripId: 't1',
  hostId: 'h',
  hostUsername: 'anna',
  hostDisplayName: 'Anna',
  title: 'Abendansitz',
  waterName: 'De Wittsee',
  date: '2026-11-14',
  from: '17:00',
  to: '21:00',
  tz: 'Europe/Berlin',
  status: 'invited',
  ...o,
});

describe('tripInvites', () => {
  it('liest Einladungen und lässt kaputte Zeilen weg', () => {
    const rows = parseTripInvites([
      {
        trip_id: 't1',
        host_id: 'h',
        host_username: 'anna',
        host_display_name: 'Anna',
        title: 'A',
        water_name: null,
        trip_date: '2026-11-14',
        from_time: '17:00',
        to_time: null,
        tz: 'Europe/Berlin',
        status: 'invited',
      },
      { trip_id: 't2', trip_date: 'gestern' },
      'x',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tripId: 't1', title: 'A', from: '17:00', date: '2026-11-14' });
    expect(rows[0]?.waterName).toBeUndefined();
    expect(parseTripInvites(null)).toEqual([]);
  });

  it('macht aus der Einladung einen eigenen Termin mit gleicher ID, ohne Position', () => {
    const t = tripFromInvite(invite());
    expect(t).toMatchObject({
      id: 't1',
      date: '2026-11-14',
      from: '17:00',
      to: '21:00',
      title: 'Abendansitz',
      waterSnapshot: { name: 'De Wittsee' },
      invitedBy: { userId: 'h', name: 'Anna' },
    });
    expect(t.waterSnapshot).not.toHaveProperty('centroid');
    // „bis“ ohne „von“ gäbe einen ungültigen Termin
    expect(tripFromInvite(invite({ from: undefined, to: '21:00' }))).not.toHaveProperty('to');
  });

  it('zeigt nur offene Einladungen, nach Tag', () => {
    const list = [
      invite({ tripId: 'b', date: '2026-11-20' }),
      invite({ tripId: 'a', date: '2026-11-15' }),
      invite({ tripId: 'c', status: 'accepted' }),
      invite({ tripId: 'd', status: 'declined' }),
    ];
    expect(openInvites(list).map((i) => i.tripId)).toEqual(['a', 'b']);
  });

  it('übernimmt Zugesagte nur, wenn der Termin hier nie da war (auch gelöschte zählen als bekannt)', () => {
    const list = [invite({ tripId: 'x', status: 'accepted' }), invite({ tripId: 'y', status: 'accepted' })];
    expect(missingAccepted(list, new Set(['y'])).map((i) => i.tripId)).toEqual(['x']);
  });

  it('beschriftet Eingeladene mit ihrer Antwort', () => {
    const replies = parseTripReplies([
      { trip_id: 't1', user_id: 'a', status: 'accepted' },
      { trip_id: 't1', user_id: 'b', status: 'declined' },
      { trip_id: 't2', user_id: 'c', status: 'accepted' },
      { trip_id: 'kaputt' },
    ]);
    const invited = [
      { userId: 'a', name: 'Anna' },
      { userId: 'b', name: 'Bert' },
      { userId: 'c', name: 'Carl' },
    ];
    expect(
      invitedWithReplies(invited, replies, 't1', { accepted: 'zugesagt', declined: 'abgesagt' }),
    ).toEqual(['Anna (zugesagt)', 'Bert (abgesagt)', 'Carl']);
  });

  it('erkennt nicht angekommene Einladungen', () => {
    expect(
      unsentInvitees({
        invited: [
          { userId: 'a', name: 'A', sent: true },
          { userId: 'b', name: 'B' },
        ],
      }).map((i) => i.userId),
    ).toEqual(['b']);
    expect(unsentInvitees({})).toEqual([]);
  });
});
