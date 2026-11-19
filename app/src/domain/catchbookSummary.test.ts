import { describe, expect, it } from 'vitest';
import { catchbookSummary } from './catchbookSummary';
import type { Catch } from './schemas';

const base = {
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  rev: 0,
  tz: 'Europe/Berlin',
};
const c = (id: string, extra: Partial<Catch>): Catch =>
  ({ ...base, id, at: '2026-06-01T08:00:00+02:00', outcome: 'caught', ...extra }) as Catch;

describe('catchbookSummary', () => {
  it('zählt nur gelandete Fische und nimmt die größte Länge', () => {
    const s = catchbookSummary(
      [
        c('1', { lengthCm: 82 }),
        c('2', { lengthCm: 64 }),
        c('3', { outcome: 'missed_bite' }),
        c('4', { outcome: 'contact', lengthCm: 120 }),
        c('5', { lengthCm: 90, deletedAt: '2026-06-02T00:00:00Z' }),
        c('6', {}),
      ],
      3,
    );
    expect(s).toEqual({ landed: 3, biggestCm: 82, waters: 3 });
  });
  it('ohne Fang oder ohne Länge: kein größter Fisch', () => {
    expect(catchbookSummary([], 0)).toEqual({ landed: 0, waters: 0 });
    expect(catchbookSummary([c('1', {})], 1)).toEqual({ landed: 1, waters: 1 });
  });
});
