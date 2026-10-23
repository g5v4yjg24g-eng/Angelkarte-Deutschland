import { describe, expect, it } from 'vitest';
import { pegelonlineLevelUrl, pegelonlineStationsUrl } from './pegelonline';

describe('PEGELONLINE', () => {
  it('Stationsliste ohne jede Positionsangabe', () => {
    const u = new URL(pegelonlineStationsUrl());
    expect(u.host).toBe('www.pegelonline.wsv.de');
    expect([...u.searchParams.keys()].sort()).toEqual(['includeCurrentMeasurement', 'includeTimeseries']);
  });
  it('Messreihe nur über die Stations-ID', () => {
    expect(pegelonlineLevelUrl('8f7e5f92-1153-4f93-acba-ca48670c8ca9')).toBe(
      'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/8f7e5f92-1153-4f93-acba-ca48670c8ca9/W/measurements.json?start=P1D',
    );
  });
});
