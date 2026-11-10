import { describe, expect, it } from 'vitest';
import { highlightedPosts, lengthText, parsePostLength, toggleHighlight, toggleInList } from './profile';

describe('parsePostLength (Paket 7a)', () => {
  it('leer = keine Angabe, Komma erlaubt, Grenzen 0–250 cm', () => {
    expect(parsePostLength('')).toBeUndefined();
    expect(parsePostLength(' 87 ')).toBe(87);
    expect(parsePostLength('87,5')).toBe(87.5);
    expect(parsePostLength('87.54')).toBe(87.5);
    expect(parsePostLength('0')).toBe('invalid');
    expect(parsePostLength('251')).toBe('invalid');
    expect(parsePostLength('etwa 80')).toBe('invalid');
    expect(lengthText(87.5)).toBe('87,5');
    expect(lengthText(undefined)).toBe('');
  });
});

describe('Profil erweitern (Paket 11, PRF-12)', () => {
  it('toggleHighlight: anheften, lösen, höchstens drei', () => {
    expect(toggleHighlight(undefined, 'a')).toEqual({ ids: ['a'], full: false });
    expect(toggleHighlight(['a', 'b'], 'a')).toEqual({ ids: ['b'], full: false });
    expect(toggleHighlight(['a', 'b', 'c'], 'd')).toEqual({ ids: ['a', 'b', 'c'], full: true });
    expect(toggleHighlight(['a', 'b', 'c'], 'b')).toEqual({ ids: ['a', 'c'], full: false });
  });
  it('highlightedPosts: Reihenfolge der Auswahl, gelöschte und fehlende fallen weg', () => {
    const posts = [{ id: 'a' }, { id: 'b', deletedAt: '2026-11-10T00:00:00Z' }, { id: 'c' }];
    expect(highlightedPosts(['c', 'b', 'x', 'a'], posts).map((p) => p.id)).toEqual(['c', 'a']);
    expect(highlightedPosts(undefined, posts)).toEqual([]);
  });
  it('toggleInList: umschalten mit Obergrenze', () => {
    expect(toggleInList(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a', 2)).toEqual(['b']);
  });
});
