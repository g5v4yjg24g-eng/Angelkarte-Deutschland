import { describe, expect, it } from 'vitest';
import { routeLinks } from './routeLinks';

describe('routeLinks', () => {
  it('baut Links mit Ziel und Auto als Verkehrsmittel', () => {
    const l = routeLinks({ lat: 51.2277, lng: 6.7735 });
    expect(l?.apple).toBe('https://maps.apple.com/?daddr=51.227700,6.773500&dirflg=d');
    expect(l?.google).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=51.227700,6.773500&travelmode=driving',
    );
  });
  it('lehnt ungültige Positionen ab', () => {
    expect(routeLinks({ lat: NaN, lng: 6 })).toBeNull();
    expect(routeLinks({ lat: 91, lng: 6 })).toBeNull();
    expect(routeLinks({ lat: 50, lng: 181 })).toBeNull();
  });
  it('behält negative Koordinaten', () => {
    expect(routeLinks({ lat: -1.5, lng: -2.5 })?.google).toContain('destination=-1.500000,-2.500000');
  });
});
