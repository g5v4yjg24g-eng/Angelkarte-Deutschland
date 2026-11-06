import { describe, expect, it } from 'vitest';
import { avatarPath, isAvatarPath, parseAvatarRows, parseSynced, planAvatarSync } from './avatarSync';

const ME = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER = 'bbbbbbbb-0000-0000-0000-000000000002';

describe('planAvatarSync', () => {
  it('neues lokales Bild wird hochgeladen, schon hochgeladenes nicht noch einmal', () => {
    expect(planAvatarSync('p1', undefined, ME)).toBe('upload');
    expect(planAvatarSync('p2', { userId: ME, photoId: 'p1' }, ME)).toBe('upload');
    expect(planAvatarSync('p1', { userId: ME, photoId: 'p1' }, ME)).toBe('none');
  });
  it('Kontowechsel: Stand eines anderen Kontos zählt nicht', () => {
    expect(planAvatarSync('p1', { userId: OTHER, photoId: 'p1' }, ME)).toBe('upload');
    expect(planAvatarSync(undefined, { userId: OTHER, photoId: 'p1' }, ME)).toBe('none');
  });
  it('lokal entfernt: nur entfernen, was dieses Gerät hochgeladen hat', () => {
    expect(planAvatarSync(undefined, { userId: ME, photoId: 'p1' }, ME)).toBe('clear');
    expect(planAvatarSync(undefined, { userId: ME, photoId: null }, ME)).toBe('none');
    // nie hochgeladen (z. B. Bild vom anderen Gerät) → nichts löschen
    expect(planAvatarSync(undefined, undefined, ME)).toBe('none');
  });
});

describe('Pfade und Zeilen', () => {
  it('Pfad passt zur Server-Prüfung', () => {
    const p = avatarPath(ME, '0123ABCD-0000-4000-8000-0123456789ab');
    expect(p).toBe(`${ME}/0123abcd0000400080000123456789ab.jpg`);
    expect(isAvatarPath(p)).toBe(true);
    expect(isAvatarPath(`${ME}/../x.jpg`)).toBe(false);
  });
  it('unbrauchbare Zeilen fallen weg', () => {
    const ok = avatarPath(ME, '0123456789abcdef0123456789abcdef');
    const m = parseAvatarRows([
      { user_id: ME, avatar_path: ok },
      { user_id: OTHER, avatar_path: 'http://evil/x.jpg' },
      null,
      { user_id: 3, avatar_path: ok },
    ]);
    expect([...m]).toEqual([[ME, ok]]);
    expect(parseAvatarRows(null).size).toBe(0);
  });
  it('gemerkter Stand: kaputter Inhalt = nichts', () => {
    expect(parseSynced(null)).toBeUndefined();
    expect(parseSynced('{')).toBeUndefined();
    expect(parseSynced('{"userId":1}')).toBeUndefined();
    expect(parseSynced(JSON.stringify({ userId: ME, photoId: null }))).toEqual({ userId: ME, photoId: null });
  });
});
