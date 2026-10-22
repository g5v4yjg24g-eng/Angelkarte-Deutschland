import { describe, expect, it } from 'vitest';
import type { Catch, Session } from '../../domain/schemas';
import { catchesCsv } from './catchCsv';

const meta = { createdAt: '2026-10-20T15:00:00+02:00', updatedAt: '2026-10-20T15:00:00+02:00', rev: 0 };
const session: Session = { id: 's', ...meta, startAt: '2026-10-20T14:00:00+02:00', tz: 'Europe/Berlin' };
const catches: Catch[] = [
  {
    id: 'b',
    ...meta,
    outcome: 'caught',
    at: '2026-10-20T15:10:00+02:00',
    tz: 'Europe/Berlin',
    speciesId: 'pike',
    lengthCm: 62.5,
    lengthMethod: 'measured',
    weightG: 1850,
    weightMethod: 'weighed',
    released: 'released',
    method: 'jigging',
    bait: { name: 'Shad; 12 cm', type: 'softbait', color: 'Motoroil' },
    stateCode: 'NI',
    position: { lat: 52.5123456, lng: 9.1, source: 'gps' },
    sessionId: 's',
    conditions: { airTempC: -3.5 },
    weather: {
      provider: 'open-meteo',
      fetchedAt: meta.createdAt,
      kind: 'model',
      forHour: '2026-10-20T13:00:00.000Z',
      tempC: -2.4,
      windMs: 3.77,
      windDirDeg: 101,
      pressureHpa: 1017.7,
      code: 3,
      attribution: 'Open-Meteo.com, CC BY 4.0',
    },
    notes: '=HYPERLINK("x")',
    photoIds: ['p1', 'p2'],
  },
  { id: 'a', ...meta, outcome: 'missed_bite', at: '2026-10-19T08:00:00+02:00', tz: 'Europe/Berlin' },
  {
    id: 'gone',
    ...meta,
    outcome: 'caught',
    at: '2026-10-18T08:00:00+02:00',
    tz: 'Europe/Berlin',
    deletedAt: meta.createdAt,
  },
];

describe('Fangbuch als CSV', () => {
  const { csv, count } = catchesCsv(catches, [session]);
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  const head = lines[0]?.split(';') ?? [];
  const row = (i: number) =>
    Object.fromEntries(head.map((h, j) => [h, lines[i]?.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)[j]]));

  it('ohne gelöschte, älteste zuerst, mit BOM', () => {
    expect(csv.startsWith('﻿Datum;Uhrzeit;Ergebnis;Art;')).toBe(true);
    expect(count).toBe(2);
    expect(row(1)).toMatchObject({ Datum: '19.10.2026', Uhrzeit: '08:00', Ergebnis: 'Fehlbiss', Art: '' });
  });

  it('Werte deutsch formatiert, Wetter als Modellwert, Text sicher', () => {
    expect(row(2)).toMatchObject({
      Datum: '20.10.2026',
      Uhrzeit: '15:10',
      Ergebnis: 'Fang',
      Art: 'Hecht',
      'Länge (cm)': '62,5',
      Länge: 'gemessen',
      'Gewicht (kg)': '1,85',
      Verbleib: 'Zurückgesetzt',
      Methode: 'Jiggen',
      Köder: '"Shad; 12 cm"',
      Köderart: 'Gummiköder',
      Bundesland: 'Niedersachsen',
      Breitengrad: '52,512346',
      Session: '20.10.2026',
      'Lufttemperatur eigene (°C)': '-3,5',
      'Wetter Temperatur (°C, Modell)': '-2,4',
      'Wetter Wind (m/s, Modell)': '3,8',
      'Wetter Windrichtung': 'O',
      'Wetter Luftdruck (hPa, Modell)': '1018',
      'Wetterlage (Modell)': 'Bedeckt',
      Fotos: '2',
      Notizen: `"'=HYPERLINK(""x"")"`,
    });
  });
});
