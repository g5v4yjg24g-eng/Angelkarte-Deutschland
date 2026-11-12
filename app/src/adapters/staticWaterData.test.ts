import { afterEach, describe, expect, it, vi } from 'vitest';
import { staticWaterData } from './staticWaterData';
import type { WaterManifest } from '../domain/water';

const manifest = {
  format: 'fangpunkt-water',
  formatVersion: 1,
  dataDate: '2026-10-21',
  generatedAt: '',
  source: { name: '', license: '', attribution: '', url: '' },
  coverage: [],
  tiles: 'water.pmtiles',
  search: 'search/',
} as unknown as WaterManifest;

const E1 = ['De Wittsee', 'lake', 51.3, 6.2, 'Nettetal', 141, 'osm:w1'];
const E2 = ['Nette', 'river', 51.2, 6.3, 'Kreis Viersen', 207, 'osm:r2'];

afterEach(() => vi.unstubAllGlobals());

describe('Alle Einträge des Suchindex (Detailsuche)', () => {
  it('lädt alle Teile, führt doppelte Einträge zusammen und meldet den Fortschritt', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        const path = new URL(String(url)).pathname;
        calls.push(path);
        const body = path.endsWith('index.json') ? ['de', 'ne'] : path.endsWith('de.json') ? [E1] : [E1, E2];
        return new Response(JSON.stringify(body));
      }),
    );
    const water = staticWaterData('https://example.test/data/water/');
    const seen: number[] = [];
    const all = await water.loadAllSearchEntries(manifest, (d) => seen.push(d));
    expect(all.map((e) => e[0]).sort()).toEqual(['De Wittsee', 'Nette']);
    expect(seen.at(-1)).toBe(1);
    // ein zweiter Aufruf lädt nichts neu
    const n = calls.length;
    await water.loadAllSearchEntries(manifest);
    expect(calls.length).toBe(n);
  });

  it('Netzfehler wirft und erlaubt einen neuen Versuch', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        if (fail) throw new Error('offline');
        const path = new URL(String(url)).pathname;
        return new Response(JSON.stringify(path.endsWith('index.json') ? ['de'] : [E1]));
      }),
    );
    const water = staticWaterData('https://example.test/data/water/');
    await expect(water.loadAllSearchEntries(manifest)).rejects.toThrow();
    fail = false;
    expect(await water.loadAllSearchEntries(manifest)).toHaveLength(1);
  });
});

describe('Fotos zu Gewässern', () => {
  const file = {
    format: 'fangpunkt-photos',
    formatVersion: 1,
    generatedAt: '2026-11-11T00:00:00Z',
    source: 'Wikimedia Commons',
    items: {
      'osm:w1': {
        f: 'De_Wittsee.jpg',
        h: 'a/a9',
        a: 'Anna',
        l: 'CC BY-SA 4.0',
        p: 'https://commons.wikimedia.org/wiki/File:De_Wittsee.jpg',
      },
    },
  };
  const withPhotos = { ...manifest, photos: 'photos.json' } as WaterManifest;

  it('ohne Eintrag im Manifest wird nichts abgerufen', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await staticWaterData('https://example.test/w/').loadPhotos(manifest)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('lädt die Fotodatei einmal und prüft sie', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(file)));
    vi.stubGlobal('fetch', f);
    const water = staticWaterData('https://example.test/w/');
    expect((await water.loadPhotos(withPhotos))?.items['osm:w1']?.a).toBe('Anna');
    await water.loadPhotos(withPhotos);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('kaputte oder fehlende Datei ergibt null und wird später erneut versucht', async () => {
    let body: Response = new Response('{"x":1}');
    const f = vi.fn(async () => body);
    vi.stubGlobal('fetch', f);
    const water = staticWaterData('https://example.test/w/');
    expect(await water.loadPhotos(withPhotos)).toBeNull();
    await Promise.resolve();
    body = new Response(JSON.stringify(file));
    expect(await water.loadPhotos(withPhotos)).not.toBeNull();
  });
});
