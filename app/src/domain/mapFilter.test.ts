import { describe, expect, it } from 'vitest';
import { ALL_LAYERS, isFiltered, parseMapFilter, visibleCatches } from './mapFilter';

const catches = [
  { id: 'a', outcome: 'caught' as const },
  { id: 'b', outcome: 'contact' as const },
  { id: 'c', outcome: 'missed_bite' as const },
  { id: 'd', outcome: 'observation' as const },
];

describe('mapFilter', () => {
  it('ohne gespeicherten Stand ist alles an; kaputter Stand ebenso', () => {
    expect(parseMapFilter(null)).toEqual(ALL_LAYERS);
    expect(parseMapFilter('{')).toEqual(ALL_LAYERS);
    expect(parseMapFilter('[]')).toEqual(ALL_LAYERS);
    expect(isFiltered(ALL_LAYERS)).toBe(false);
  });
  it('liest nur bekannte Schalter mit Wahr/Falsch', () => {
    const f = parseMapFilter(JSON.stringify({ contact: false, places: 'nein', fremd: false }));
    expect(f).toEqual({ ...ALL_LAYERS, contact: false });
    expect(isFiltered(f)).toBe(true);
  });
  it('blendet Arten aus, behält aber das Sprungziel', () => {
    const f = { ...ALL_LAYERS, contact: false, missed_bite: false };
    expect(visibleCatches(catches, f).map((c) => c.id)).toEqual(['a', 'd']);
    expect(visibleCatches(catches, f, { keep: 'b' }).map((c) => c.id)).toEqual(['a', 'b', 'd']);
  });
  it('Heatmap zählt gelandete Fische immer', () => {
    const f = { ...ALL_LAYERS, caught: false };
    expect(visibleCatches(catches, f).map((c) => c.id)).toEqual(['b', 'c', 'd']);
    expect(visibleCatches(catches, f, { heat: true }).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
