import { describe, expect, it } from 'vitest';
import {
  attribution,
  buildPhotos,
  commonsInfo,
  crestUrl,
  entityIso,
  fileFromCommonsTag,
  imageOfEntity,
  isFreeLicense,
  PhotosFileSchema,
  plainText,
  thumbUrl,
  toFileName,
  wikidataId,
  type CommonsInfo,
} from './waterPhotos';

describe('Dateinamen und Kennungen', () => {
  it('Commons-Tag: nur File: mit jpg/jpeg/png', () => {
    expect(fileFromCommonsTag('File:Möhnesee Staumauer.jpg')).toBe('Möhnesee_Staumauer.jpg');
    expect(fileFromCommonsTag('file:Foo.PNG')).toBe('Foo.PNG');
    expect(fileFromCommonsTag('Category:Möhnesee')).toBeUndefined();
    expect(fileFromCommonsTag('File:Karte.svg')).toBeUndefined();
    expect(fileFromCommonsTag('File:Film.webm')).toBeUndefined();
    expect(fileFromCommonsTag(undefined)).toBeUndefined();
  });
  it('Wikidata-Kennung', () => {
    expect(wikidataId('Q168855')).toBe('Q168855');
    expect(wikidataId(' q12 ')).toBe('Q12');
    expect(wikidataId('P18')).toBeUndefined();
    expect(wikidataId('Q12;Q13')).toBeUndefined();
  });
  it('toFileName ersetzt Leerzeichen', () => {
    expect(toFileName('A  b.jpeg')).toBe('A_b.jpeg');
    expect(toFileName('a.gif')).toBeUndefined();
  });
});

describe('Bild eines Wikidata-Objekts (P18)', () => {
  const claim = (v: unknown, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value: v } } });
  it('bevorzugter Rang vor normalem, abgelehnte nie', () => {
    expect(imageOfEntity({ claims: { P18: [claim('Erste.jpg'), claim('Zweite.jpg', 'preferred')] } })).toBe(
      'Zweite.jpg',
    );
    expect(imageOfEntity({ claims: { P18: [claim('Alt.jpg', 'deprecated'), claim('Gut.jpg')] } })).toBe(
      'Gut.jpg',
    );
    expect(imageOfEntity({ claims: { P18: [claim('Alt.jpg', 'deprecated')] } })).toBeUndefined();
  });
  it('ohne Bild oder mit ungeeignetem Format nichts', () => {
    expect(imageOfEntity(undefined)).toBeUndefined();
    expect(imageOfEntity({ claims: {} })).toBeUndefined();
    expect(imageOfEntity({ claims: { P18: [claim('Karte.svg')] } })).toBeUndefined();
    expect(imageOfEntity({ claims: { P18: [claim(42)] } })).toBeUndefined();
  });
});

describe('Lizenzen', () => {
  it('freie Lizenzen werden akzeptiert', () => {
    for (const l of [
      'CC0',
      'CC BY 4.0',
      'CC BY-SA 3.0',
      'CC BY-SA 4.0',
      'CC-BY-SA-3.0',
      'Public domain',
      'PD-self',
    ])
      expect(isFreeLicense(l), l).toBe(true);
  });
  it('NC, ND, unklare und leere nicht', () => {
    for (const l of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'Copyrighted', 'Fair use', '', 'GPL'])
      expect(isFreeLicense(l), l).toBe(false);
    expect(isFreeLicense(undefined)).toBe(false);
  });
});

describe('plainText', () => {
  it('entfernt HTML, entschärft Entities, kürzt', () => {
    expect(plainText('<a href="x">Max&nbsp;M&uuml;ller</a> &amp; Co')).toBe('Max M&uuml;ller & Co');
    expect(plainText('  a   b ')).toBe('a b');
    expect(plainText('x'.repeat(200), 20)).toHaveLength(20);
    expect(plainText(undefined)).toBe('');
  });
});

describe('commonsInfo', () => {
  const page = (over: Record<string, unknown> = {}, meta: Record<string, string> = {}) => ({
    title: 'File:De Wittsee.jpg',
    imageinfo: [
      {
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:De_Wittsee.jpg',
        extmetadata: {
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
          Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Anna">Anna</a>' },
          ...Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, { value: v }])),
        },
      },
    ],
    ...over,
  });
  it('liest Urheber, Lizenz und Seite', () => {
    expect(commonsInfo(page())).toEqual({
      file: 'De_Wittsee.jpg',
      author: 'Anna',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:De_Wittsee.jpg',
    });
  });
  it('lehnt fehlende, nichtfreie und unsichere Angaben ab', () => {
    expect(commonsInfo(page({ missing: true }))).toBeUndefined();
    expect(commonsInfo(page({}, { LicenseShortName: 'CC BY-NC 4.0' }))).toBeUndefined();
    expect(commonsInfo(page({}, { NonFree: 'true' }))).toBeUndefined();
    expect(commonsInfo(page({ title: 'File:Karte.svg' }))).toBeUndefined();
    expect(
      commonsInfo({
        title: 'File:A.jpg',
        imageinfo: [
          { descriptionurl: 'https://evil.example/x', extmetadata: { LicenseShortName: { value: 'CC0' } } },
        ],
      }),
    ).toBeUndefined();
  });
  it('ohne Urheber fällt es auf „Credit“ zurück', () => {
    const p = page({}, { Artist: '', Credit: 'Eigenes Werk' });
    expect(commonsInfo(p)?.author).toBe('Eigenes Werk');
  });
});

describe('buildPhotos', () => {
  const info = (file: string): CommonsInfo => ({
    file,
    author: 'A',
    license: 'CC0',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:' + file,
  });
  const hash = (f: string) => (f.startsWith('E') ? 'a/a9' : 'b/bb');
  it('Commons-Tag vor Wikidata; nur geprüfte Dateien', () => {
    const out = buildPhotos(
      {
        'osm:w1': { wc: 'Direkt.jpg', wd: 'Q1' },
        'osm:w2': { wd: 'Q2' },
        'osm:w3': { wd: 'Q3' },
        'osm:w4': { wc: 'Unbekannt.jpg' },
      },
      new Map([
        ['Q1', 'Falsch.jpg'],
        ['Q2', 'Example.jpg'],
      ]),
      new Map([
        ['Direkt.jpg', info('Direkt.jpg')],
        ['Example.jpg', info('Example.jpg')],
      ]),
      hash,
    );
    expect(Object.keys(out).sort()).toEqual(['osm:w1', 'osm:w2']);
    expect(out['osm:w1']?.f).toBe('Direkt.jpg');
    expect(out['osm:w2']).toMatchObject({ f: 'Example.jpg', h: 'a/a9', l: 'CC0' });
  });
});

describe('Adresse und Namensnennung', () => {
  it('Vorschau nur auf upload.wikimedia.org mit Standardbreite', () => {
    expect(thumbUrl({ f: 'Example.jpg', h: 'a/a9' }, 250)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/250px-Example.jpg',
    );
    expect(thumbUrl({ f: 'Möhne (See).jpg', h: 'a/a9' }, 500)).toContain('/M%C3%B6hne_(See).jpg/500px-');
  });
  it('Namensnennung nennt Urheber, Lizenz und Quelle', () => {
    expect(attribution({ a: 'Anna', l: 'CC BY-SA 4.0' })).toBe('Anna · CC BY-SA 4.0 · Wikimedia Commons');
    expect(attribution({ a: '', l: 'CC0' })).toBe('CC0 · Wikimedia Commons');
  });
  it('Schema prüft die Datei', () => {
    const ok = {
      format: 'fangpunkt-photos',
      formatVersion: 1,
      generatedAt: 't',
      source: 'Wikimedia Commons',
      items: {
        'osm:w1': {
          f: 'A.jpg',
          h: 'a/a9',
          a: 'x',
          l: 'CC0',
          p: 'https://commons.wikimedia.org/wiki/File:A.jpg',
        },
      },
    };
    expect(PhotosFileSchema.safeParse(ok).success).toBe(true);
    expect(
      PhotosFileSchema.safeParse({ ...ok, items: { x: { ...ok.items['osm:w1'], h: 'zz' } } }).success,
    ).toBe(false);
  });
});

describe('Landeswappen', () => {
  it('SVG-Vorschau kommt als PNG von Wikimedia', () => {
    expect(crestUrl({ f: 'Wappen_NRW.svg', h: 'a/a9' }, 120)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Wappen_NRW.svg/120px-Wappen_NRW.svg.png',
    );
  });
  it('SVG nur für Wappen erlaubt, P94 gelesen', () => {
    expect(toFileName('A.svg')).toBeUndefined();
    expect(toFileName('A.svg', true)).toBe('A.svg');
    const e = { claims: { P94: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Wappen X.svg' } } }] } };
    expect(imageOfEntity(e)).toBeUndefined();
    expect(imageOfEntity(e, 'P94')).toBe('Wappen_X.svg');
  });
  it('ISO-Code des Objekts', () => {
    expect(entityIso({ claims: { P300: [{ mainsnak: { datavalue: { value: 'DE-NW' } } }] } })).toBe('DE-NW');
    expect(entityIso({ claims: {} })).toBeUndefined();
  });
  it('Breite 960 für Banner', () => {
    expect(thumbUrl({ f: 'A.jpg', h: 'a/a9' }, 960)).toContain('/960px-A.jpg');
  });
});
