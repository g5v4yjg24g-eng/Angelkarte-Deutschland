import { describe, expect, it } from 'vitest';
import { parseSignalAnswers } from './capacitorSignalActions';

const ID = '3f2b8c1e-7d4a-4b6f-9a21-0c5e8d7b1a42';

describe('parseSignalAnswers (SIG-2)', () => {
  it('nimmt vollständige Antworten und verwirft den Rest', () => {
    expect(
      parseSignalAnswers([
        { signal: ID, accept: true, at: 1_800_000_000_000 },
        { signal: ID, accept: 'ja', at: 1 },
        { signal: 'x', accept: true, at: 1 },
        { signal: ID, accept: false, at: Number.NaN },
        { signal: '../../etc', accept: true, at: 1 },
        null,
      ]),
    ).toEqual([{ signalId: ID, accept: true, atMs: 1_800_000_000_000 }]);
    expect(parseSignalAnswers(undefined)).toEqual([]);
  });
});
