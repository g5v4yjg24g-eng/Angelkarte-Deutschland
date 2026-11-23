import { describe, expect, it } from 'vitest';
import {
  OVERDUE_MS,
  SNOOZE_MS,
  decideAlert,
  dismissBand,
  hoursOpen,
  parseAlertState,
  parseModAlertSummary,
  snoozeFull,
  type ModAlertSummary,
} from './modAlerts';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const sum = (o: Partial<ModAlertSummary> = {}): ModAlertSummary => ({
  openCount: 1,
  oldestAt: ago(60_000),
  newestId: 'r1',
  newestAt: ago(60_000),
  newestType: 'post',
  newestReason: 'abuse',
  ...o,
});

describe('parseModAlertSummary', () => {
  it('liest eine Zeile', () => {
    expect(
      parseModAlertSummary([
        {
          open_count: 2,
          oldest_at: ago(1000),
          newest_id: 'x',
          newest_at: ago(10),
          newest_type: 'spot',
          newest_reason: 'spam',
        },
      ]),
    ).toMatchObject({ openCount: 2, newestId: 'x', newestType: 'spot', newestReason: 'spam' });
  });
  it('ohne offene Meldung: leere Felder', () => {
    const s = parseModAlertSummary([{ open_count: 0, oldest_at: null, newest_id: null }]);
    expect(s).toEqual({ openCount: 0 });
  });
  it('kaputt oder leer = undefined', () => {
    expect(parseModAlertSummary([])).toBeUndefined();
    expect(parseModAlertSummary([{ open_count: 'x' }])).toBeUndefined();
    expect(parseModAlertSummary(null)).toBeUndefined();
  });
});

describe('decideAlert', () => {
  it('nichts ohne offene Meldung', () => {
    expect(decideAlert(sum({ openCount: 0 }), {}, NOW)).toBeUndefined();
    expect(decideAlert(undefined, {}, NOW)).toBeUndefined();
  });
  it('neue Meldung → Band, einmal je Meldung', () => {
    expect(decideAlert(sum(), {}, NOW)?.kind).toBe('band');
    expect(decideAlert(sum(), dismissBand(sum(), {}), NOW)).toBeUndefined();
    // eine weitere, neuere Meldung zeigt es wieder
    expect(decideAlert(sum({ newestId: 'r2', openCount: 2 }), dismissBand(sum(), {}), NOW)?.kind).toBe(
      'band',
    );
  });
  it('älteste Meldung ≥ 20 h → Vollbild, auch wenn die neueste schon gesehen ist', () => {
    const s = sum({ oldestAt: ago(OVERDUE_MS), openCount: 3 });
    expect(decideAlert(s, dismissBand(s, {}), NOW)?.kind).toBe('full');
    expect(
      decideAlert(sum({ oldestAt: ago(OVERDUE_MS - 60_000) }), dismissBand(sum(), {}), NOW),
    ).toBeUndefined();
  });
  it('„Später“ im Vollbild gibt 30 Minuten Ruhe', () => {
    const s = sum({ oldestAt: ago(OVERDUE_MS + 1) });
    const st = snoozeFull(s, {}, NOW);
    expect(st.snoozeUntil).toBe(NOW + SNOOZE_MS);
    expect(decideAlert(s, st, NOW + SNOOZE_MS - 1)).toBeUndefined();
    expect(decideAlert(s, st, NOW + SNOOZE_MS)?.kind).toBe('full');
  });
});

it('hoursOpen rundet ab, mindestens 1', () => {
  expect(hoursOpen(10 * 60_000)).toBe(1);
  expect(hoursOpen(21.9 * 3_600_000)).toBe(21);
});

describe('parseAlertState', () => {
  it('liest gespeicherten Stand und verträgt Kaputtes', () => {
    expect(parseAlertState('{"seenNewestId":"a","snoozeUntil":5}')).toEqual({
      seenNewestId: 'a',
      snoozeUntil: 5,
    });
    expect(parseAlertState('kaputt')).toEqual({});
    expect(parseAlertState(null)).toEqual({ seenNewestId: undefined, snoozeUntil: undefined });
  });
});
