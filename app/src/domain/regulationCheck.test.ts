import { describe, expect, it } from 'vitest';
import BY from '../../data/regulations/BY.json';
import HH from '../../data/regulations/HH.json';
import { RegulationSetSchema, type RegulationSet } from './regulations';
import { checkCatch, findings, violations, type StateResolution } from './regulationCheck';

const by = RegulationSetSchema.parse(BY);
const hh = RegulationSetSchema.parse(HH);
const inBY: StateResolution = { kind: 'state', code: 'BY' };
const pike = (at: string, lengthCm?: number, extra: object = {}) => ({
  outcome: 'caught' as const,
  speciesId: 'pike',
  at,
  ...(lengthCm !== undefined ? { lengthCm, lengthMethod: 'measured' as const } : {}),
  ...extra,
});

describe('Rechts-Warnung beim Erfassen (Bayern, echte Landesdatei)', () => {
  it('Hecht in der Schonzeit (15.02.–30.04.) und unter 50 cm → zwei Verstöße mit Fundstelle', () => {
    const r = checkCatch(pike('2026-03-10T10:00:00+01:00', 45), inBY, by);
    expect(r.status).toBe('checked');
    if (r.status !== 'checked') return;
    expect(r.findings.map((f) => f.kind).sort()).toEqual(['closed', 'undersize']);
    expect(r.findings.find((f) => f.kind === 'undersize')?.rule.basisRef).toBe('Anlage Nr. 2.36');
  });

  it('Grenzen der Schonzeit zählen mit; außerhalb und maßig → nichts', () => {
    const first = checkCatch(pike('2026-02-15T06:00:00+01:00', 60), inBY, by);
    const last = checkCatch(pike('2026-04-30T21:00:00+02:00', 60), inBY, by);
    const after = checkCatch(pike('2026-05-01T06:00:00+02:00', 60), inBY, by);
    expect(first.status === 'checked' && first.findings.map((f) => f.kind)).toEqual(['closed']);
    expect(last.status === 'checked' && last.findings.map((f) => f.kind)).toEqual(['closed']);
    expect(after.status === 'checked' && after.findings).toEqual([]);
  });

  it('ohne Länge: Hinweis „Länge fehlt", kein Verstoß', () => {
    const r = checkCatch(pike('2026-06-01T10:00:00+02:00'), inBY, by);
    expect(r.status === 'checked' && r.findings.map((f) => f.kind)).toEqual(['needsLength']);
    expect(r.status === 'checked' && violations(r.findings)).toEqual([]);
  });

  it('geschätzte Länge und zurückgesetzt werden markiert', () => {
    const r = checkCatch(
      pike('2026-06-01T10:00:00+02:00', 40, { lengthMethod: 'estimated', released: 'released' }),
      inBY,
      by,
    );
    expect(r).toMatchObject({ status: 'checked', estimated: true, released: true });
  });
});

describe('Entnahmefenster (Hamburg, echte Landesdatei)', () => {
  const eel = (len: number) => ({
    outcome: 'caught' as const,
    speciesId: 'eel',
    at: '2026-07-01T10:00:00+02:00',
    lengthCm: len,
  });
  it('unter, im und über dem Fenster', () => {
    const rule = hh.minSizes.find((r) => r.speciesId === 'eel' && r.maxCm !== undefined);
    expect(rule).toBeDefined();
    const kinds = (len: number) =>
      findings(hh, eel(len))
        .filter((f) => f.kind !== 'closed')
        .map((f) => f.kind);
    expect(kinds((rule?.minCm ?? 0) - 1)).toEqual(['undersize']);
    expect(kinds((rule?.minCm ?? 0) + 1)).toEqual([]);
    expect(kinds((rule?.maxCm ?? 0) + 1)).toEqual(['oversize']);
  });
});

describe('Status ohne Prüfung', () => {
  const base = pike('2026-03-10T10:00:00+01:00', 45);
  it('nur gelandete Fische mit Art', () => {
    expect(checkCatch({ ...base, outcome: 'contact' }, inBY, by).status).toBe('notApplicable');
    expect(checkCatch({ ...base, speciesId: undefined }, inBY, by).status).toBe('notApplicable');
    expect(checkCatch({ ...base, speciesId: 'other' }, inBY, by).status).toBe('notApplicable');
  });
  it('Land unbekannt, Grenznähe, keine Daten (z. B. NRW), Entwurf', () => {
    expect(checkCatch(base, { kind: 'unknown' }, by).status).toBe('noState');
    expect(checkCatch(base, { kind: 'outside' }, by).status).toBe('noState');
    expect(checkCatch(base, { kind: 'border', codes: ['NI', 'HB'] }, undefined)).toEqual({
      status: 'chooseState',
      candidates: ['NI', 'HB'],
    });
    expect(checkCatch(base, { kind: 'state', code: 'NW' }, undefined)).toEqual({
      status: 'noData',
      state: 'NW',
    });
    const draft: RegulationSet = { ...by, status: 'draft' };
    expect(checkCatch(base, inBY, draft).status).toBe('noData');
  });
  it('Regeln ohne Artzuordnung werden nicht geraten', () => {
    const noId: RegulationSet = {
      ...by,
      closedSeasons: by.closedSeasons.map(
        (r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'speciesId')) as typeof r,
      ),
    };
    const r = checkCatch(base, inBY, noId);
    expect(r.status === 'checked' && r.findings.some((f) => f.kind === 'closed')).toBe(false);
  });
});
