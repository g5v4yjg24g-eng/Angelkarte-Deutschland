import { describe, expect, it } from 'vitest';
import { loadRegulation } from './regulations';

describe('loadRegulation', () => {
  it('Land ohne Datei → none', async () => expect(await loadRegulation('NW')).toEqual({ kind: 'none' }));

  it('gegengeprüftes Land wird geladen', async () => {
    const r = await loadRegulation('BY');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.set.status).toBe('partial');
  });
});
