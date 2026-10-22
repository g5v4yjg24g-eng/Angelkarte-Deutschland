import { afterEach, describe, expect, it, vi } from 'vitest';
import { weatherQuery } from '../domain/weather';
import { openMeteo, openMeteoUrl } from './openMeteo';

const q = weatherQuery('2026-10-20T15:00:00+02:00', { lat: 53.5512345, lng: 9.9934567 });

describe('Open-Meteo-Adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sendet nur gerundete Koordinaten, Stunden in GMT und Wind in m/s', () => {
    const u = new URL(openMeteoUrl(q));
    expect(u.host).toBe('historical-forecast-api.open-meteo.com');
    expect(u.searchParams.get('latitude')).toBe('53.551');
    expect(u.searchParams.get('longitude')).toBe('9.993');
    expect(u.searchParams.get('start_hour')).toBe('2026-10-20T10:00');
    expect(u.searchParams.get('end_hour')).toBe('2026-10-20T13:00');
    expect(u.searchParams.get('timezone')).toBe('GMT');
    expect(u.searchParams.get('wind_speed_unit')).toBe('ms');
  });

  it('liefert einen Modellwert mit Quelle; HTTP-Fehler werfen', async () => {
    const body = { hourly: { time: ['2026-10-20T13:00'], temperature_2m: [9.4] } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    expect(await openMeteo().fetchHour(q)).toMatchObject({
      provider: 'open-meteo',
      kind: 'model',
      tempC: 9.4,
      attribution: 'Open-Meteo.com, CC BY 4.0',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(openMeteo().fetchHour(q)).rejects.toThrow('HTTP 429');
  });
});

describe('Open-Meteo-Vorhersage', () => {
  it('sendet nur gerundete Koordinaten, Zeiten als Unix-Zeit, deutsche Zeitzone', async () => {
    const { openMeteoForecastUrl } = await import('./openMeteo');
    const u = new URL(openMeteoForecastUrl({ lat: 51.325, lng: 6.243 }));
    expect(u.host).toBe('api.open-meteo.com');
    expect(u.searchParams.get('latitude')).toBe('51.325');
    expect(u.searchParams.get('timeformat')).toBe('unixtime');
    expect(u.searchParams.get('timezone')).toBe('Europe/Berlin');
    expect(u.searchParams.get('hourly')).toContain('pressure_msl');
  });
});
