import { describe, expect, it } from 'vitest';
import { alertsBetween, alertsQuery, parseBrightSkyAlerts, severityLevel } from './alerts';

// Auszug einer echten Antwort (api.brightsky.dev/alerts?lat=51.32&lon=6.24, Abruf 2026-10-22)
const sample = {
  alerts: [
    {
      id: 3041826,
      alert_id: '2.49.0.0.276.0.DWD.PVW.1792688820000.f8587cb2',
      status: 'actual',
      effective: '2026-10-22T17:07:00+00:00',
      onset: '2026-10-23T11:00:00+00:00',
      expires: '2026-10-24T00:00:00+00:00',
      response_type: 'prepare',
      severity: 'moderate',
      event_de: 'STURMBÖEN',
      headline_de: 'Amtliche WARNUNG vor STURMBÖEN',
      description_de: 'Es treten Sturmböen mit Geschwindigkeiten zwischen 70 km/h und 85 km/h auf.',
      instruction_de: 'Gefahr durch: einzelne herabstürzende Äste.',
    },
    {
      id: 2,
      alert_id: 'b',
      status: 'actual',
      effective: '2026-10-22T17:00:00+00:00',
      onset: '2026-10-23T06:00:00+00:00',
      expires: '2026-10-23T12:00:00+00:00',
      response_type: 'prepare',
      severity: 'minor',
      event_de: 'WINDBÖEN',
      headline_de: 'Amtliche WARNUNG vor WINDBÖEN',
    },
    {
      id: 3,
      alert_id: 'c',
      status: 'test',
      severity: 'extreme',
      event_de: 'TEST',
      headline_de: 'Test',
      onset: '2026-10-23T00:00:00+00:00',
    },
    {
      id: 4,
      alert_id: 'd',
      status: 'actual',
      response_type: 'allclear',
      severity: 'minor',
      event_de: 'X',
      headline_de: 'Entwarnung',
      onset: '2026-10-23T00:00:00+00:00',
    },
  ],
  location: { warn_cell_id: 805166016, name: 'Stadt Nettetal', district: 'Viersen' },
};
const q = alertsQuery({ lat: 51.31871, lng: 6.25012 });

describe('Amtliche Warnungen', () => {
  it('Koordinaten nur gerundet', () => {
    expect(q).toEqual({ lat: 51.319, lng: 6.25 });
  });

  it('liest Warnungen, ohne Test-Meldungen und Entwarnungen', () => {
    const a = parseBrightSkyAlerts(sample, q, 1);
    expect(a?.place).toBe('Stadt Nettetal');
    expect(a?.alerts.map((x) => x.event)).toEqual(['STURMBÖEN', 'WINDBÖEN']);
    expect(a?.alerts[0]).toMatchObject({ severity: 'moderate', from: '2026-10-23T11:00:00+00:00' });
  });

  it('unbrauchbare Antwort → null', () => {
    expect(parseBrightSkyAlerts({ foo: 1 }, q, 1)).toBeNull();
    expect(parseBrightSkyAlerts(null, q, 1)).toBeNull();
  });

  it('Zeitraum: Überschneidung, höchste Stufe zuerst; ohne Ende gilt sie weiter', () => {
    const a = parseBrightSkyAlerts(sample, q, 1)?.alerts ?? [];
    const t = (s: string) => Date.parse(s);
    // 23.10. 8–10 Uhr UTC: nur Windböen; 10–13 Uhr: beide, Sturmböen (Stufe 2) vor Windböen (Stufe 1)
    expect(
      alertsBetween(a, t('2026-10-23T08:00:00Z'), t('2026-10-23T10:00:00Z')).map((x) => x.event),
    ).toEqual(['WINDBÖEN']);
    expect(
      alertsBetween(a, t('2026-10-23T10:00:00Z'), t('2026-10-23T13:00:00Z')).map((x) => x.event),
    ).toEqual(['STURMBÖEN', 'WINDBÖEN']);
    expect(alertsBetween(a, t('2026-10-24T00:00:00Z'), t('2026-10-25T00:00:00Z'))).toEqual([]);
    const wind = a[1];
    if (!wind) throw new Error('Windböen fehlen');
    const open = [{ ...wind, to: undefined }];
    expect(alertsBetween(open, t('2027-01-01T00:00:00Z'), t('2027-01-02T00:00:00Z'))).toHaveLength(1);
    expect(severityLevel('extreme')).toBe(4);
  });
});
