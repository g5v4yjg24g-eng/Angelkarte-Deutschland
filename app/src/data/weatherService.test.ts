// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { WeatherQuery, WeatherSnapshot } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather';
import { saveCatch } from './catchService';
import { fillMissingWeather, pendingWeatherIds } from './weatherService';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const base = {
  outcome: 'caught' as const,
  at: '2026-10-20T15:00:00+02:00',
  tz: 'Europe/Berlin',
  position: { lat: 53.551234, lng: 9.993456, source: 'gps' as const },
};
const snap = (q: WeatherQuery): WeatherSnapshot => ({
  provider: 'open-meteo',
  fetchedAt: '2026-10-22T12:00:00Z',
  kind: 'model',
  forHour: q.forHour,
  tempC: 9.4,
  attribution: 'Open-Meteo.com, CC BY 4.0',
});
const provider = (
  impl: WeatherProvider['fetchHour'],
): WeatherProvider & { fetchHour: ReturnType<typeof vi.fn> } => ({
  id: 'test',
  fetchHour: vi.fn(impl),
});

describe('Wetter nachladen (WX-1)', () => {
  it('lädt Wetter für Fänge mit Standort; ohne Standort oder vor 2022 wird nicht gefragt', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    await saveCatch({ input: { ...base, position: undefined } }, db);
    await saveCatch({ input: { ...base, at: '2021-06-01T12:00:00+02:00' } }, db);
    const p = provider(async (q) => snap(q));
    const run = await fillMissingWeather(p, { nowMs: NOW }, db);
    expect(run.filled).toEqual([a.id]);
    expect(p.fetchHour).toHaveBeenCalledTimes(1);
    expect(p.fetchHour.mock.calls[0]?.[0]).toMatchObject({ lat: 53.551, lng: 9.993 });
    expect((await db.catches.get(a.id))?.weather?.tempC).toBe(9.4);
    expect(await pendingWeatherIds(db, NOW)).toEqual([]);
  });

  it('Netzfehler: bricht ab, Fang bleibt offen und wird beim nächsten Lauf geladen', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const run = await fillMissingWeather(
      provider(() => Promise.reject(new TypeError('offline'))),
      { nowMs: NOW },
      db,
    );
    expect(run.error).toBeInstanceOf(TypeError);
    expect(await pendingWeatherIds(db, NOW)).toEqual([a.id]);
    const again = await fillMissingWeather(
      provider(async (q) => snap(q)),
      { nowMs: NOW },
      db,
    );
    expect(again.filled).toEqual([a.id]);
  });

  it('keine Werte beim Dienst → nichts speichern, in diesem Lauf überspringen', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const run = await fillMissingWeather(
      provider(async () => null),
      { nowMs: NOW },
      db,
    );
    expect(run).toMatchObject({ filled: [], noData: [a.id] });
    expect((await db.catches.get(a.id))?.weather).toBeUndefined();
    const p = provider(async (q) => snap(q));
    await fillMissingWeather(p, { nowMs: NOW, skip: new Set(run.noData) }, db);
    expect(p.fetchHour).not.toHaveBeenCalled();
  });

  it('während der Abfrage verschobener Fang bekommt kein falsches Wetter', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const p = provider(async (q) => {
      await saveCatch({ id: a.id, changes: { at: '2026-10-20T18:00:00+02:00' } }, db);
      return snap(q);
    });
    const run = await fillMissingWeather(p, { nowMs: NOW }, db);
    expect(run.filled).toEqual([]);
    expect((await db.catches.get(a.id))?.weather).toBeUndefined();
  });

  it('Bearbeiten: andere Stunde oder anderer Ort verwirft das Wetter, Notizen nicht', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    await fillMissingWeather(
      provider(async (q) => snap(q)),
      { nowMs: NOW },
      db,
    );
    const n = await saveCatch({ id: a.id, changes: { notes: 'Biss am Schilf' } }, db);
    expect(n.weather?.tempC).toBe(9.4);
    const moved = await saveCatch(
      { id: a.id, changes: { position: { lat: 53.6, lng: 10, source: 'map-tap' } } },
      db,
    );
    expect(moved.weather).toBeUndefined();
    expect(await pendingWeatherIds(db, NOW)).toEqual([a.id]);
  });
});
