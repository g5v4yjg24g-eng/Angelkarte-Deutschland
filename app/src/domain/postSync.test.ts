import { describe, expect, it } from 'vitest';
import type { Post } from './schemas';
import { planPostSync, shareStatus } from './postSync';

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
    const plan = planPostSync([
      post({ id: 'neu', share: 'pending' }),
      post({ id: 'geändert', share: 'shared', rev: 2, sharedRev: 1 }),
      post({ id: 'gleich', share: 'shared', rev: 1, sharedRev: 1 }),
      post({ id: 'lokal' }),
    ]);
    expect(ids(plan.upload)).toEqual(['neu']);
    expect(ids(plan.update)).toEqual(['geändert']);
    expect(plan.remove).toEqual([]);
  });

  it('gelöscht oder nicht mehr teilen: nur Hochgeladenes wird entfernt', () => {
    const plan = planPostSync([
      post({ id: 'weg', share: 'shared', deletedAt: '2026-11-05T11:00:00.000Z' }),
      post({ id: 'zurück', share: 'unshare' }),
      post({ id: 'nie-oben', share: 'pending', deletedAt: '2026-11-05T11:00:00.000Z' }),
      post({ id: 'lokal-weg', deletedAt: '2026-11-05T11:00:00.000Z' }),
    ]);
    expect(ids(plan.remove)).toEqual(['weg', 'zurück']);
    expect(plan.upload).toEqual([]);
  });

  it('Anzeige', () => {
    expect(shareStatus({})).toBe('local');
    expect(shareStatus({ share: 'pending' })).toBe('pending');
    expect(shareStatus({ share: 'shared' })).toBe('shared');
    expect(shareStatus({ share: 'unshare' })).toBe('local');
  });
});
