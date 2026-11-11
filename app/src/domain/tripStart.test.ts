import { describe, expect, it } from 'vitest';
import type { GroupMember } from './groupSessions';
import {
  MAX_TRIP_INVITEES,
  START_ESCAPE_MS,
  canStartWithout,
  parsePendingStart,
  parseStartRequests,
  requestFresh,
  toggleInvitee,
  waitState,
  waitingNames,
} from './tripStart';

const m = (name: string, status: GroupMember['status'], isHost = false): GroupMember => ({
  userId: `u-${name}`,
  username: name,
  displayName: name,
  status,
  isHost,
});

describe('tripStart', () => {
  it('wählt Eingeladene an und ab, höchstens 9', () => {
    let list = toggleInvitee([], { userId: 'a', name: 'Anna' });
    list = toggleInvitee(list, { userId: 'b', name: 'Bert' });
    expect(list.map((i) => i.userId)).toEqual(['a', 'b']);
    expect(toggleInvitee(list, { userId: 'a', name: 'Anna' }).map((i) => i.userId)).toEqual(['b']);
    const full = Array.from({ length: MAX_TRIP_INVITEES }, (_, i) => ({ userId: `u${i}`, name: `N${i}` }));
    expect(toggleInvitee(full, { userId: 'neu', name: 'Neu' })).toHaveLength(MAX_TRIP_INVITEES);
  });

  it('liest Start-Anfragen und lässt kaputte Zeilen weg', () => {
    const rows = parseStartRequests([
      {
        id: 'g1',
        host_id: 'h',
        host_username: 'anna',
        host_display_name: 'Anna',
        title: 'Abend',
        water_name: null,
        started_at: '2026-11-11T10:00:00Z',
      },
      { id: 'g2' },
      'x',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'g1', hostDisplayName: 'Anna', title: 'Abend' });
    expect(rows[0]?.waterName).toBeUndefined();
    expect(parseStartRequests(undefined)).toEqual([]);
  });

  it('prüft den gemerkten Wartezustand', () => {
    const ok = parsePendingStart(JSON.stringify({ groupId: 'g', names: ['Anna'], since: 5 }));
    expect(ok).toEqual({ groupId: 'g', names: ['Anna'], since: 5 });
    expect(parsePendingStart('kaputt')).toBeUndefined();
    expect(parsePendingStart(JSON.stringify({ groupId: '', names: [], since: 1 }))).toBeUndefined();
    expect(parsePendingStart(null)).toBeUndefined();
  });

  it('wartet, bis mindestens eine Person bestätigt hat', () => {
    expect(waitState([m('Kevin', 'joined', true), m('Anna', 'invited')])).toBe('waiting');
    expect(waitState([m('Kevin', 'joined', true), m('Anna', 'invited'), m('Bert', 'joined')])).toBe(
      'confirmed',
    );
    expect(waitState([m('Kevin', 'joined', true), m('Anna', 'declined'), m('Bert', 'declined')])).toBe(
      'declined',
    );
    // eine Absage, eine offen → weiter warten
    expect(waitState([m('Kevin', 'joined', true), m('Anna', 'declined'), m('Bert', 'invited')])).toBe(
      'waiting',
    );
    expect(waitState([m('Kevin', 'joined', true)])).toBe('waiting');
    expect(waitingNames([m('Kevin', 'joined', true), m('Anna', 'invited'), m('Bert', 'declined')])).toEqual([
      'Anna',
    ]);
  });

  it('bietet „Ohne … starten“ nach 2 Minuten oder bei Absage', () => {
    expect(canStartWithout('waiting', 0, START_ESCAPE_MS - 1)).toBe(false);
    expect(canStartWithout('waiting', 0, START_ESCAPE_MS)).toBe(true);
    expect(canStartWithout('declined', 0, 1)).toBe(true);
    expect(canStartWithout('confirmed', 0, START_ESCAPE_MS * 5)).toBe(false);
  });

  it('zeigt alte Anfragen nicht mehr', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    expect(requestFresh({ startedAt: '2026-11-11T11:00:00Z' }, now)).toBe(true);
    expect(requestFresh({ startedAt: '2026-11-11T05:00:00Z' }, now)).toBe(false);
  });
});
