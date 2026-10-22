import { describe, expect, it } from 'vitest';
import { daySummaries, forecastQuery, hourAt, parseOpenMeteoForecast, pressureChange } from './forecast';

// Synthetische Antwort (timeformat=unixtime) über die Zeitumstellung am 25.10.2026 (03:00 MESZ → 02:00 MEZ)
const H = 3600;
const day0 = Date.UTC(2026, 9, 24, 22) / 1000; // 25.10. 00:00 MESZ
const day1 = Date.UTC(2026, 9, 25, 23) / 1000; // 26.10. 00:00 MEZ (der 25. hat 25 Stunden)
const hours = Array.from({ length: 49 }, (_, i) => day0 + i * H);
const json = {
  hourly: {
    time: hours,
    pressure_msl: hours.map((_, i) => 1020 - i * 0.5),
    temperature_2m: hours.map(() => 9),
    wind_speed_10m: hours.map((_, i) => (i === 10 ? 8 : 3)),
    wind_gusts_10m: hours.map(() => 6),
    weather_code: hours.map(() => 3),
  },
  daily: {
    time: [day0, day1],
    sunrise: [day0 + 8 * H, day1 + 7 * H],
    sunset: [day0 + 18 * H, day1 + 17 * H],
    temperature_2m_max: [12, 11],
    temperature_2m_min: [6, 5],
    precipitation_sum: [1.2, 0],
    weather_code: [61, 3],
  },
};
const q = forecastQuery({ lat: 51.32456, lng: 6.24321 });

describe('Wettervorhersage', () => {
  it('rundet die Abfrage auf 3 Stellen', () => {
    expect(q).toEqual({ lat: 51.325, lng: 6.243 });
  });

  it('wertet die Antwort aus; Zeiten eindeutig als ms, auch über die Zeitumstellung', () => {
    const f = parseOpenMeteoForecast(json, q, 1);
    expect(f?.hours).toHaveLength(49);
    expect(f?.days.map((d) => d.t)).toEqual([day0 * 1000, day1 * 1000]);
    expect(f?.days[0]).toMatchObject({
      tMax: 12,
      tMin: 6,
      precipSum: 1.2,
      code: 61,
      sunrise: (day0 + 8 * H) * 1000,
    });
  });

  it('der Tag der Zeitumstellung hat 25 Stunden', () => {
    const f = parseOpenMeteoForecast(json, q, 1);
    const days = f ? daySummaries(f) : [];
    expect(days[0]?.hours).toHaveLength(25);
    expect(days[0]).toMatchObject({
      windMaxMs: 8,
      gustMaxMs: 6,
      pressureMax: 1020,
      pressureMin: 1008,
      pressureDelta: -12,
    });
  });

  it('Luftdruck-Änderung über 3 h; ohne Vorwert keine', () => {
    const f = parseOpenMeteoForecast(json, q, 1);
    if (!f) throw new Error('keine Vorhersage');
    expect(pressureChange(f, (day0 + 5 * H) * 1000)).toBe(-1.5);
    expect(pressureChange(f, day0 * 1000)).toBeUndefined();
    expect(hourAt(f, (day0 + 5 * H + 1000) * 1000)?.t).toBe((day0 + 5 * H) * 1000);
  });

  it('Fehlerantwort oder fehlende Reihen → null', () => {
    expect(parseOpenMeteoForecast({ error: true, reason: 'x' }, q, 1)).toBeNull();
    expect(parseOpenMeteoForecast({ hourly: { time: [] }, daily: { time: [] } }, q, 1)).toBeNull();
  });
});
