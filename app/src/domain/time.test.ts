import { describe, expect, it } from 'vitest';
import { localToZonedIso, toZonedIso } from './time';

describe('Zeitzonen (Europe/Berlin)', () => {
  it('Winterzeit +01:00, Sommerzeit +02:00', () => {
    expect(localToZonedIso('2026-01-15', '08:30')).toBe('2026-01-15T08:30:00+01:00');
    expect(localToZonedIso('2026-07-15', '08:30')).toBe('2026-07-15T08:30:00+02:00');
  });
  it('Umstellung im März: 01:59 Winter, 03:00 Sommer', () => {
    expect(localToZonedIso('2026-03-29', '01:59')).toBe('2026-03-29T01:59:00+01:00');
    expect(localToZonedIso('2026-03-29', '03:00')).toBe('2026-03-29T03:00:00+02:00');
  });
  it('Fang kurz vor und nach Mitternacht bleibt am richtigen Kalendertag', () => {
    expect(localToZonedIso('2026-10-24', '23:30')).toBe('2026-10-24T23:30:00+02:00');
    expect(localToZonedIso('2026-10-25', '00:30')).toBe('2026-10-25T00:30:00+02:00');
  });
  it('toZonedIso und Date.parse sind zueinander konsistent', () => {
    const ms = Date.parse('2026-10-21T12:05:00Z');
    const iso = toZonedIso(ms);
    expect(iso).toBe('2026-10-21T14:05:00+02:00');
    expect(Date.parse(iso)).toBe(ms);
  });
  it('lehnt ungültige Eingaben ab', () => {
    expect(() => localToZonedIso('21.10.2026', '10:00')).toThrow();
  });
});
