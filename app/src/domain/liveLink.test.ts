import { describe, expect, it } from 'vitest';
import { liveLinkAction } from './liveLink';

describe('liveLinkAction', () => {
  it('liest die Aktionen der Live-Activity-Knöpfe', () => {
    for (const a of ['pause', 'resume', 'end', 'catch', 'review', 'open'])
      expect(liveLinkAction(`fangpunkt://session/${a}`)).toBe(a);
    expect(liveLinkAction('fangpunkt://session/pause/')).toBe('pause');
  });
  it('alles andere wird ignoriert', () => {
    expect(liveLinkAction('fangpunkt://session/loeschen')).toBeUndefined();
    expect(liveLinkAction('fangpunkt://profil/pause')).toBeUndefined();
    expect(liveLinkAction('https://fangpunkt.com/session/pause')).toBeUndefined();
    expect(liveLinkAction('https://fangpunkt.com/profil/?u=anna')).toBeUndefined();
    expect(liveLinkAction('kaputt')).toBeUndefined();
    expect(liveLinkAction('')).toBeUndefined();
  });
});
