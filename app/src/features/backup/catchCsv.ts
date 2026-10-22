// Fangbuch als CSV (P2): eine Zeile je Eintrag, älteste zuerst. Wetter ist als Modellwert gekennzeichnet.
import { de } from '../../i18n/de';
import { toCsv, type Cell } from '../../domain/csv';
import { compassIndex } from '../../domain/weather';
import { speciesById } from '../../domain/species';
import type { Catch, Session } from '../../domain/schemas';

const b = de.backup;
const f = de.catchForm;
/** Zahl gerundet auf `d` Stellen; bleibt eine Zahl (Text würde z. B. „-3,5“ als Formel entschärfen). */
const num = (n: number | undefined, d: number) =>
  n === undefined ? undefined : Math.round(n * 10 ** d) / 10 ** d;
const COLUMNS = Object.keys(b.csvColumns) as (keyof typeof b.csvColumns)[];

export function catchesCsv(
  catches: readonly Catch[],
  sessions: readonly Session[],
): { csv: string; count: number } {
  const sessionLabel = new Map(
    sessions.map((s) => [
      s.id,
      s.title ?? `${s.startAt.slice(8, 10)}.${s.startAt.slice(5, 7)}.${s.startAt.slice(0, 4)}`,
    ]),
  );
  const rows = catches
    .filter((c) => !c.deletedAt)
    .sort((a, z) => Date.parse(a.at) - Date.parse(z.at))
    .map((c) => {
      const w = c.weather;
      const v: Record<(typeof COLUMNS)[number], Cell> = {
        // Zeitpunkte tragen den Offset ihrer Zeitzone: Datum und Uhrzeit sind schon lokal
        date: `${c.at.slice(8, 10)}.${c.at.slice(5, 7)}.${c.at.slice(0, 4)}`,
        time: c.at.slice(11, 16),
        outcome: de.map.outcomes[c.outcome],
        species: speciesById(c.speciesId)?.de,
        lengthCm: num(c.lengthCm, 1),
        lengthMethod: c.lengthMethod && b.methodLabels[c.lengthMethod],
        weightKg: num(c.weightG === undefined ? undefined : c.weightG / 1000, 3),
        weightMethod: c.weightMethod && b.methodLabels[c.weightMethod],
        released: c.released && f.releasedOptions[c.released],
        contactDetail: c.contactDetail && f.contactDetails[c.contactDetail],
        method: c.method && f.methods[c.method],
        bait: c.bait?.name,
        baitType: c.bait?.type && f.baitTypes[c.bait.type],
        baitColor: c.bait?.color,
        water: c.waterSnapshot?.name,
        state: c.stateCode && de.water.states[c.stateCode],
        lat: num(c.position?.lat, 6),
        lng: num(c.position?.lng, 6),
        session: c.sessionId ? sessionLabel.get(c.sessionId) : undefined,
        airTempC: num(c.conditions?.airTempC, 1),
        waterTempC: num(c.conditions?.waterTempC, 1),
        wxTempC: num(w?.tempC, 1),
        wxWindMs: num(w?.windMs, 1),
        wxWindDir: w?.windDirDeg === undefined ? undefined : de.weather.compass[compassIndex(w.windDirDeg)],
        wxPressureHpa: num(w?.pressureHpa, 0),
        wxSky:
          w?.code === undefined ? undefined : (de.weather.codes[w.code] ?? de.weather.codeUnknown(w.code)),
        photos: c.photoIds?.length || undefined,
        notes: c.notes,
      };
      return COLUMNS.map((k) => v[k]);
    });
  return {
    csv: toCsv(
      COLUMNS.map((k) => b.csvColumns[k]),
      rows,
    ),
    count: rows.length,
  };
}
