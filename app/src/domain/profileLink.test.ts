import { describe, expect, it } from 'vitest';
import { profileLink, profileLinkTarget } from './profileLink';

describe('Profil-Link (PRF-13)', () => {
  it('Link enthält nur den Nutzernamen', () => {
    expect(profileLink('kevin_1')).toBe('https://fangpunkt.com/profil/?u=kevin_1');
  });
  it('nur gültige Links von fangpunkt.com führen ins Profil', () => {
    expect(profileLinkTarget('https://fangpunkt.com/profil/?u=kevin')).toBe('/profil/nutzer/kevin');
    expect(profileLinkTarget('https://www.fangpunkt.com/profil?u=Kevin')).toBe('/profil/nutzer/kevin');
    expect(profileLinkTarget('http://fangpunkt.com/profil/?u=kevin')).toBeUndefined();
    expect(profileLinkTarget('https://evil.example/profil/?u=kevin')).toBeUndefined();
    expect(profileLinkTarget('https://fangpunkt.com.evil.example/profil/?u=kevin')).toBeUndefined();
    expect(profileLinkTarget('https://fangpunkt.com/datenschutz/')).toBeUndefined();
    expect(profileLinkTarget('https://fangpunkt.com/profil/?u=../mehr')).toBeUndefined();
    expect(profileLinkTarget('https://fangpunkt.com/profil/?u=ab')).toBeUndefined();
    expect(profileLinkTarget('kein link')).toBeUndefined();
  });
});
