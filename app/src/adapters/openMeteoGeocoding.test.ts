import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMeteoGeocoding, openMeteoGeocodingUrl } from './openMeteoGeocoding';

afterEach(() => vi.unstubAllGlobals());

describe('openMeteoGeocoding', () => {
  it('schickt nur den Suchbegriff (und feste Einstellungen), keine Position', () => {
    const u = new URL(openMeteoGeocodingUrl('Köln'));
    expect(u.host).toBe('geocoding-api.open-meteo.com');
    expect([...u.searchParams.keys()].sort()).toEqual(['count', 'countryCode', 'format', 'language', 'name']);
    expect(u.searchParams.get('name')).toBe('Köln');
    expect(u.searchParams.get('countryCode')).toBe('DE');
  });

  it('liest die Antwort und meldet Fehler', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [{ id: 1, name: 'Köln', latitude: 50.9, longitude: 6.9, country_code: 'DE' }],
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const hits = await openMeteoGeocoding().search('Köln');
    expect(hits).toEqual([{ id: '1', name: 'Köln', lat: 50.9, lng: 6.9 }]);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('x', { status: 500 })));
    await expect(openMeteoGeocoding().search('Köln')).rejects.toThrow('HTTP 500');
  });
});
