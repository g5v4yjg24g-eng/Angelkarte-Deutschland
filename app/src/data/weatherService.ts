// Wetter zu Fängen nachladen (ARCHITECTURE §7: nur online, fehlende Werte beim nächsten Online-Start).
import { needsWeather, weatherQuery, WeatherSnapshotSchema, type WeatherSnapshot } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

/** Höchstens so viele Abfragen pro Lauf; der Rest folgt beim nächsten Lauf (Open-Meteo-Limits, DATA_SOURCES §6). */
export const WEATHER_BATCH = 20;

export interface WeatherRun {
  filled: string[];
  /** Dienst hatte keine Werte – in diesem Lauf nicht erneut fragen */
  noData: string[];
  /** Abbruch wegen Netz-/Dienstfehler; offene Fänge bleiben für den nächsten Lauf */
  error?: unknown;
}

/** Fänge, die noch Wetter brauchen, neueste zuerst. */
export async function pendingWeatherIds(db: FangpunktDB = getDb(), nowMs = Date.now()): Promise<string[]> {
  const rows = await db.catches.filter((c) => needsWeather(c, nowMs)).toArray();
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((c) => c.id);
}

export async function fillMissingWeather(
  provider: WeatherProvider,
  { skip = new Set<string>(), limit = WEATHER_BATCH, nowMs = Date.now() } = {},
  db: FangpunktDB = getDb(),
): Promise<WeatherRun> {
  const run: WeatherRun = { filled: [], noData: [] };
  const ids = (await pendingWeatherIds(db, nowMs)).filter((id) => !skip.has(id)).slice(0, limit);
  for (const id of ids) {
    const c = await db.catches.get(id);
    if (!c?.position || !needsWeather(c, nowMs)) continue;
    const q = weatherQuery(c.at, c.position);
    let snap: WeatherSnapshot | null;
    try {
      snap = await provider.fetchHour(q);
    } catch (error) {
      run.error = error;
      break;
    }
    if (!snap || !WeatherSnapshotSchema.safeParse(snap).success) {
      run.noData.push(id);
      continue;
    }
    // Nur speichern, wenn der Fang inzwischen nicht verschoben, gelöscht oder schon versorgt wurde.
    const saved = await db.transaction('rw', db.catches, async () => {
      const cur = await db.catches.get(id);
      if (!cur?.position || !needsWeather(cur, nowMs)) return false;
      const now = weatherQuery(cur.at, cur.position);
      if (now.forHour !== q.forHour || now.lat !== q.lat || now.lng !== q.lng) return false;
      await repo('catches', db).update(id, { weather: snap });
      return true;
    });
    if (saved) run.filled.push(id);
  }
  return run;
}
