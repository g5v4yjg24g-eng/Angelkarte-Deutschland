import { describe, expect, it } from 'vitest';
import { brightSkyAlertsUrl } from './brightSky';

describe('Bright Sky', () => {
  it('fragt nur mit gerundeten Koordinaten (3 Stellen)', () => {
    const u = new URL(brightSkyAlertsUrl({ lat: 51.31871, lng: 6.25012 }));
    expect(u.origin + u.pathname).toBe('https://api.brightsky.dev/alerts');
    expect(u.searchParams.get('lat')).toBe('51.319');
    expect(u.searchParams.get('lon')).toBe('6.250');
    expect([...u.searchParams.keys()].sort()).toEqual(['lat', 'lon', 'tz']);
  });
});
