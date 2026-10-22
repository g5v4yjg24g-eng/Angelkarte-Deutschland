import { describe, expect, it } from 'vitest';
import type { Catch } from './schemas';
import {
  compassIndex,
  needsWeather,
  parseOpenMeteoHourly,
  roundCoord,
  weatherQuery,
  weatherStillValid,
} from './weather';

// Gekürzte echte Antwort der Historical-Forecast-API (Hamburg, 2026-10-20, abgerufen 2026-10-22)
const RESPONSE = {
  timezone: 'GMT',
  hourly: {
    time: ['2026-10-20T10:00', '2026-10-20T11:00', '2026-10-20T12:00', '2026-10-20T13:00'],
    temperature_2m: [8.7, 9.3, 9.6, 9.4],
    pressure_msl: [1020.7, 1019.7, 1019.1, 1017.7],
    wind_speed_10m: [3.14, 3.26, 3.58, 3.77],
    wind_direction_10m: [112, 108, 113, 101],
    wind_gusts_10m: [6.4, 6.8, 7.4, 7.4],
    cloud_cover: [100, 63, 100, 100],
    precipitation: [0, 0, 0, 0],
    weather_code: [3, 2, 3, 3],
  },
};

const pos = { lat: 53.551234, lng: 9.993456 };
const catchAt = (at: string, extra: Partial<Catch> = {}): Catch => ({
  id: 'c1',
  createdAt: at,
  updatedAt: at,
  rev: 0,
  outcome: 'caught',
  at,
  tz: 'Europe/Berlin',
  position: { ...pos, source: 'gps' },
  ...extra,
});

describe('Wetter am Fang (WX)', () => {
  it('rundet Koordinaten auf 3 Nachkommastellen, bevor sie das Gerät verlassen', () => {
    expect(roundCoord(53.551234)).toBe(53.551);
    expect(roundCoord(9.9935)).toBe(9.994);
    const q = weatherQuery('2026-10-20T15:20:00+02:00', pos);
    expect([q.lat, q.lng]).toEqual([53.551, 9.993]);
  });

  it('fragt die nächste volle Stunde (UTC) und 3 h davor ab', () => {
    expect(weatherQuery('2026-10-20T15:20:00+02:00', pos)).toMatchObject({
      startHour: '2026-10-20T10:00',
      endHour: '2026-10-20T13:00',
      forHour: '2026-10-20T13:00:00.000Z',
    });
    expect(weatherQuery('2026-10-20T15:31:00+02:00', pos).endHour).toBe('2026-10-20T14:00');
  });

  it('wertet die Antwort aus: Werte der Fangstunde, Drucktendenz über 3 h', () => {
    const q = weatherQuery('2026-10-20T15:00:00+02:00', pos);
    expect(parseOpenMeteoHourly(RESPONSE, q)).toEqual({
      forHour: '2026-10-20T13:00:00.000Z',
      tempC: 9.4,
      pressureHpa: 1017.7,
      pressureTrend3h: -3,
      windMs: 3.77,
      windDirDeg: 101,
      gustMs: 7.4,
      cloudPct: 100,
      precipMm: 0,
      code: 3,
    });
  });

  it('fehlende Stunde, Fehlerantwort oder nur Nullwerte → null (nichts erfinden)', () => {
    const q = weatherQuery('2026-10-21T15:00:00+02:00', pos);
    expect(parseOpenMeteoHourly(RESPONSE, q)).toBeNull();
    expect(parseOpenMeteoHourly({ error: true, reason: 'x' }, q)).toBeNull();
    const q2 = weatherQuery('2026-10-20T15:00:00+02:00', pos);
    const empty = { hourly: { time: RESPONSE.hourly.time, temperature_2m: [null, null, null, null] } };
    expect(parseOpenMeteoHourly(empty, q2)).toBeNull();
  });

  it('ohne Vorwert keine Tendenz', () => {
    const q = weatherQuery('2026-10-20T15:00:00+02:00', pos);
    const r = { hourly: { time: ['2026-10-20T13:00'], pressure_msl: [1017.7] } };
    expect(parseOpenMeteoHourly(r, q)).toEqual({ forHour: q.forHour, pressureHpa: 1017.7 });
  });

  it('braucht Wetter nur mit Standort, ohne Wetter, ab 2022 und nicht in der Zukunft', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(needsWeather(catchAt('2026-10-20T15:00:00+02:00'), now)).toBe(true);
    expect(needsWeather(catchAt('2026-10-20T15:00:00+02:00', { position: undefined }), now)).toBe(false);
    expect(needsWeather(catchAt('2021-12-31T12:00:00+01:00'), now)).toBe(false);
    expect(needsWeather(catchAt('2026-10-23T12:00:00+02:00'), now)).toBe(false);
    expect(
      needsWeather(catchAt('2026-10-20T15:00:00+02:00', { deletedAt: '2026-10-21T00:00:00Z' }), now),
    ).toBe(false);
  });

  it('Wetter bleibt nur gültig, solange Stunde und gerundeter Ort gleich sind', () => {
    const a = catchAt('2026-10-20T15:00:00+02:00');
    expect(weatherStillValid(a, { ...a, at: '2026-10-20T15:20:00+02:00' })).toBe(true);
    expect(weatherStillValid(a, { ...a, at: '2026-10-20T16:00:00+02:00' })).toBe(false);
    expect(weatherStillValid(a, { ...a, position: { lat: 53.6, lng: 9.99, source: 'map-tap' } })).toBe(false);
    expect(weatherStillValid(a, { ...a, position: undefined })).toBe(false);
  });

  it('Windrichtung in Achteln', () => {
    expect([0, 44, 46, 101, 180, 350, 360].map(compassIndex)).toEqual([0, 1, 1, 2, 4, 0, 0]);
  });
});
