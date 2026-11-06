import { describe, expect, it } from 'vitest';
import { lengthText, parsePostLength } from './profile';

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
