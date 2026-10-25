import { describe, expect, it } from 'vitest';
import { loadRegulation } from './regulations';
import { STATE_CODES } from '../domain/water';

describe('loadRegulation', () => {
  // Seit 2026-10-25 haben alle 16 Länder eine gegengeprüfte Datei (Leerzustand: StateLawPage.test.tsx)
  it('alle Länder werden geladen', async () => {
    for (const code of STATE_CODES) expect((await loadRegulation(code)).kind, code).toBe('ok');
  });

  it('gegengeprüftes Land wird geladen', async () => {
    const r = await loadRegulation('BY');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.set.status).toBe('partial');
  });
});
