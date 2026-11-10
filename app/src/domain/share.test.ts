import { describe, expect, it } from 'vitest';
import { postShareText, sharePhotoName } from './share';

describe('Teilen (SHR-1)', () => {
  it('Text aus Fischart, Länge, Beschreibung und Hinweis – ohne leere Teile', () => {
    expect(postShareText({ caption: ' Am Steg ', speciesId: 'pike', lengthCm: 87.5 }, 'Fangpunkt')).toBe(
      'Hecht · 87,5 cm\n\nAm Steg\n\nFangpunkt',
    );
    expect(postShareText({}, 'Fangpunkt')).toBe('Fangpunkt');
    expect(postShareText({ caption: '   ' }, 'F')).toBe('F');
  });

  it('Dateinamen der Fotos nach Datum und Nummer', () => {
    expect(sharePhotoName('2026-11-06T10:00:00+01:00', 0, 'image/jpeg')).toBe('fangpunkt-2026-11-06-1.jpg');
    expect(sharePhotoName('2026-11-06T10:00:00+01:00', 2, 'image/webp')).toBe('fangpunkt-2026-11-06-3.webp');
  });
});
