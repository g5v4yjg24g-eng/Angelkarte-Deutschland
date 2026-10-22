import { describe, expect, it } from 'vitest';
import { loadRegulation } from './regulations';

describe('loadRegulation', () => {
  it('Land ohne Datei → none', async () => expect(await loadRegulation('BE')).toEqual({ kind: 'none' }));

  it('Entwurf bleibt verborgen, außer in der Prüfansicht', async () => {
    expect(await loadRegulation('BY')).toEqual({ kind: 'none' });
    const r = await loadRegulation('BY', { includeDraft: true });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.set.status).toBe('draft');
  });
});
