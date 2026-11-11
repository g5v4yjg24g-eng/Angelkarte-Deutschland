import { describe, expect, it } from 'vitest';
import { DEFAULT_PUSH_PREFS, parsePushPrefs, pushTarget, validPushToken } from './push';

describe('Push-Mitteilungen (PUSH-1)', () => {
  it('liest die Einstellungen; fehlt die Zeile oder ist sie kaputt, ist alles an', () => {
    expect(parsePushPrefs([{ friends: true, likes: false, comments: true, spots: false }])).toEqual({
      friends: true,
      likes: false,
      comments: true,
      spots: false,
      sessions: true, // älterer Server ohne Spalte
      posts: true,
    });
    expect(
      parsePushPrefs([{ friends: true, likes: true, comments: true, spots: true, sessions: false }]).sessions,
    ).toBe(false);
    expect(parsePushPrefs([])).toEqual(DEFAULT_PUSH_PREFS);
    expect(parsePushPrefs([{ friends: 'ja' }])).toEqual(DEFAULT_PUSH_PREFS);
    expect(parsePushPrefs(null)).toEqual(DEFAULT_PUSH_PREFS);
  });

  it('springt beim Antippen nur in bekannte Bereiche der App', () => {
    expect(pushTarget({ path: '/profil/freunde' })).toBe('/profil/freunde');
    expect(pushTarget({ path: '/profil/spots' })).toBe('/profil/spots');
    expect(pushTarget({ path: '/wetter/kalender' })).toBe('/wetter/kalender');
    expect(pushTarget({ path: '/fangbuch/sessions' })).toBe('/fangbuch/sessions');
    expect(pushTarget({ path: '/profil/beitrag/2648da34-224f-4ce7-bcb3-e530f11d5b22' })).toBe(
      '/profil/beitrag/2648da34-224f-4ce7-bcb3-e530f11d5b22',
    );
    expect(pushTarget({ path: 'https://boese.example/' })).toBeUndefined();
    expect(pushTarget({ path: '/profil/beitrag/../../mehr/konto' })).toBeUndefined();
    expect(pushTarget({ path: '/mehr/konto' })).toBeUndefined();
    expect(pushTarget(null)).toBeUndefined();
    expect(pushTarget({})).toBeUndefined();
  });

  it('nimmt nur Geräte-Token aus Hexziffern an', () => {
    expect(validPushToken('a'.repeat(64))).toBe(true);
    expect(validPushToken('A1'.repeat(32))).toBe(true);
    expect(validPushToken('xyz')).toBe(false);
    expect(validPushToken(`${'a'.repeat(64)};drop`)).toBe(false);
  });
});

describe('Stand der Mitteilungen (PUSH-4)', () => {
  it('parsePushStatus und pushTestState', async () => {
    const { parsePushStatus, pushTestState } = await import('./push');
    expect(parsePushStatus([])).toEqual({ devices: 0 });
    const none = parsePushStatus([{ devices: 1, test_at: null }]);
    expect(none).toEqual({ devices: 1, test: undefined });
    expect(pushTestState(none)).toBe('none');
    const waiting = parsePushStatus([{ devices: 1, test_at: 'x', test_sent_at: null, test_error: null }]);
    expect(pushTestState(waiting)).toBe('waiting');
    expect(pushTestState(parsePushStatus([{ devices: 1, test_at: 'x', test_sent_at: 'y' }]))).toBe('sent');
    expect(
      pushTestState(
        parsePushStatus([{ devices: 1, test_at: 'x', test_sent_at: 'y', test_error: 'BadDeviceToken' }]),
      ),
    ).toBe('error');
  });
  it('ältere Server-Antwort ohne „posts“ → an', async () => {
    const { parsePushPrefs } = await import('./push');
    expect(parsePushPrefs([{ friends: true, likes: false, comments: true, spots: true }]).posts).toBe(true);
  });
});
