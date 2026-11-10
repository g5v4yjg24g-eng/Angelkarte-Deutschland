import { describe, expect, it } from 'vitest';
import type { Post } from './schemas';
import {
  mimeOfPath,
  nextWake,
  photoPath,
  planPostSync,
  postsToAdopt,
  retryAt,
  shareStatus,
  syncSummary,
  thumbPath,
} from './postSync';

const ME = 'u1';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const post = (o: Partial<Post>): Post => ({
  id: 'p',
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
  rev: 0,
  photoIds: ['f'],
  ...o,
});
const ids = (ps: Post[]) => ps.map((p) => p.id);

describe('Beiträge abgleichen (PST-1)', () => {
  it('neu, geändert, unverändert, nur lokal', () => {
    const plan = planPostSync(
      [
        post({ id: 'neu', share: 'pending' }),
        post({ id: 'geändert', share: 'shared', rev: 2, sharedRev: 1 }),
        post({ id: 'gleich', share: 'shared', rev: 1, sharedRev: 1 }),
        post({ id: 'lokal' }),
      ],
      ME,
      NOW,
    );
    expect(ids(plan.upload)).toEqual(['neu']);
    expect(ids(plan.update)).toEqual(['geändert']);
    expect(plan.remove).toEqual([]);
  });

  it('gelöscht oder nicht mehr teilen: nur Hochgeladenes wird entfernt', () => {
    const plan = planPostSync(
      [
        post({ id: 'weg', share: 'shared', deletedAt: '2026-11-05T11:00:00.000Z' }),
        post({ id: 'zurück', share: 'unshare' }),
        post({ id: 'nie-oben', share: 'pending', deletedAt: '2026-11-05T11:00:00.000Z' }),
        post({ id: 'lokal-weg', deletedAt: '2026-11-05T11:00:00.000Z' }),
      ],
      ME,
      NOW,
    );
    expect(ids(plan.remove)).toEqual(['weg', 'zurück']);
    expect(plan.upload).toEqual([]);
  });

  it('nur eigenes Konto, nur fällige Versuche, nie bei fehlender Datei', () => {
    const plan = planPostSync(
      [
        post({ id: 'fremd', share: 'pending', accountId: 'u2' }),
        post({ id: 'mein', share: 'pending', accountId: ME }),
        post({ id: 'wartet', share: 'pending', syncRetryAt: '2026-11-10T12:05:00.000Z' }),
        post({ id: 'fällig', share: 'pending', syncRetryAt: '2026-11-10T11:59:00.000Z' }),
        post({ id: 'datei', share: 'pending', syncError: 'photo_missing' }),
      ],
      ME,
      NOW,
    );
    expect(ids(plan.upload)).toEqual(['mein', 'fällig']);
  });

  it('Übernahme: nur lokale, nicht gelöschte, nicht fremde', () => {
    expect(
      ids(
        postsToAdopt(
          [
            post({ id: 'a' }),
            post({ id: 'b', share: 'shared' }),
            post({ id: 'c', deletedAt: '2026-11-05T11:00:00.000Z' }),
            post({ id: 'd', accountId: 'u2' }),
          ],
          ME,
        ),
      ),
    ).toEqual(['a']);
  });

  it('Wartezeiten wachsen: 1, 5, 30 min, 2 h, 6 h, dann 12 h', () => {
    const mins = [1, 2, 3, 4, 5, 6, 9].map((n) => (Date.parse(retryAt(n, NOW)) - NOW) / 60_000);
    expect(mins).toEqual([1, 5, 30, 120, 360, 720, 720]);
    expect(
      nextWake(
        [
          post({ share: 'pending', syncRetryAt: '2026-11-10T13:00:00.000Z' }),
          post({ share: 'pending', syncRetryAt: '2026-11-10T12:30:00.000Z' }),
          post({ share: 'pending', syncRetryAt: '2026-11-10T11:00:00.000Z' }),
          post({ share: 'shared', sharedRev: 0, syncRetryAt: '2026-11-10T12:10:00.000Z' }),
        ],
        NOW,
      ),
    ).toBe(Date.parse('2026-11-10T12:30:00.000Z'));
  });

  it('Anzeige und Zusammenfassung', () => {
    expect(shareStatus({})).toBe('local');
    expect(shareStatus({ share: 'pending' })).toBe('pending');
    expect(shareStatus({ share: 'pending', syncError: 'failed' })).toBe('failed');
    expect(shareStatus({ share: 'pending', syncError: 'limited' })).toBe('limited');
    expect(shareStatus({ share: 'pending', syncError: 'photo_missing' })).toBe('missing');
    expect(shareStatus({ share: 'shared' })).toBe('shared');
    expect(shareStatus({ share: 'unshare' })).toBe('local');
    expect(
      syncSummary(
        [
          post({ share: 'shared' }),
          post({ share: 'pending' }),
          post({ share: 'pending', syncError: 'failed' }),
          post({ share: 'pending', syncError: 'photo_missing' }),
          post({}),
          post({ share: 'shared', accountId: 'u2' }),
          post({ share: 'shared', deletedAt: '2026-11-05T11:00:00.000Z' }),
        ],
        ME,
      ),
    ).toEqual({ total: 5, saved: 1, waiting: 2, failed: 1, missing: 1 });
  });

  it('Speicherpfade', () => {
    expect(photoPath('u', 'p', 0, 'image/jpeg')).toBe('u/p/1.jpg');
    expect(photoPath('u', 'p', 1, 'image/png')).toBe('u/p/2.png');
    expect(thumbPath('u/p/2.png')).toBe('u/p/2.thumb.jpg');
    expect(mimeOfPath('u/p/2.webp')).toBe('image/webp');
  });
});
