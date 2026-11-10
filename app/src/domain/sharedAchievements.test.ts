import { describe, expect, it } from 'vitest';
import { isAchVisibility, parseRemoteAchievements, uploadEntries, uploadKey } from './sharedAchievements';

describe('sharedAchievements', () => {
  it('lädt nur bekannte Stufen mit gültigem Datum hoch', () => {
    expect(
      uploadEntries({
        first: '2026-11-01T10:00:00Z',
        'catches:bronze': '2026-11-02T10:00:00Z',
        'catches:platin': '2026-11-02T10:00:00Z',
        'pike:gold': 'gestern',
      }),
    ).toEqual({ first: '2026-11-01T10:00:00Z', 'catches:bronze': '2026-11-02T10:00:00Z' });
  });

  it('Merker hängt nur an Konto und Stufen, nicht an der Reihenfolge', () => {
    expect(uploadKey('u1', { b: '1', a: '2' })).toBe(uploadKey('u1', { a: '2', b: '1' }));
    expect(uploadKey('u1', { a: '1' })).not.toBe(uploadKey('u2', { a: '1' }));
  });

  it('liest freigegebene, leere und verborgene Erfolge', () => {
    expect(
      parseRemoteAchievements([
        { visible: true, key: 'first', unlocked_at: '2026-11-01T10:00:00+00:00' },
        { visible: true, key: 'unbekannt', unlocked_at: '2026-11-01T10:00:00+00:00' },
      ]),
    ).toEqual({ visible: true, unlocked: { first: '2026-11-01T10:00:00+00:00' } });
    expect(parseRemoteAchievements([{ visible: true, key: null, unlocked_at: null }])).toEqual({
      visible: true,
      unlocked: {},
    });
    expect(parseRemoteAchievements([{ visible: false, key: null, unlocked_at: null }])).toEqual({
      visible: false,
    });
    expect(parseRemoteAchievements([])).toEqual({ visible: false });
    expect(parseRemoteAchievements(null)).toEqual({ visible: false });
  });

  it('kennt nur drei Sichtbarkeiten', () => {
    expect(isAchVisibility('friends')).toBe(true);
    expect(isAchVisibility('alle')).toBe(false);
  });
});
