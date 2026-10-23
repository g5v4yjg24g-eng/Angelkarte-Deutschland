import { describe, expect, it } from 'vitest';
import type { Trip } from './schemas';
import { foldLine, icsText, tripsToIcs } from './ics';

const meta = { createdAt: '2026-10-22T10:00:00+02:00', updatedAt: '2026-10-22T10:00:00+02:00', rev: 0 };
const txt = { defaultTitle: 'Angeln', reminder: 'Angeltermin' };
const now = Date.parse('2026-10-23T08:00:00Z');
const trip = (extra: Partial<Trip>): Trip => ({
  id: 't1',
  ...meta,
  date: '2026-10-25',
  tz: 'Europe/Berlin',
  ...extra,
});
const unfold = (s: string) => s.replace(/\r\n /g, '');

describe('Kalenderdatei (.ics)', () => {
  it('Termin mit Uhrzeit: UTC-Zeiten (25.10.: Winterzeit ab 3 Uhr), Ort, Koordinaten, Erinnerung 1 h vorher', () => {
    const ics = tripsToIcs(
      [
        trip({
          from: '06:00',
          to: '10:30',
          title: 'Hecht, Zander; Barsch',
          notes: 'Boot mitnehmen\nKöder: Shad',
          waterSnapshot: { name: 'De Wittsee', place: 'Nettetal', centroid: { lat: 51.31871, lng: 6.25012 } },
        }),
      ],
      now,
      txt,
    );
    const u = unfold(ics);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(u).toContain('DTSTART:20261025T050000Z'); // 06:00 MEZ
    expect(u).toContain('DTEND:20261025T093000Z');
    expect(u).toContain('SUMMARY:Hecht\\, Zander\\; Barsch');
    expect(u).toContain('LOCATION:De Wittsee\\, Nettetal');
    expect(u).toContain('GEO:51.31871;6.25012');
    expect(u).toContain('DESCRIPTION:Boot mitnehmen\\nKöder: Shad');
    expect(u).toContain('UID:t1@fangpunkt');
    expect(u).toContain('TRIGGER:-PT60M');
    expect(u).toContain('DTSTAMP:20261023T080000Z');
  });

  it('ganztägig: Datum ohne Uhrzeit, Ende am Folgetag, Erinnerung am Vorabend 18 Uhr', () => {
    const u = unfold(tripsToIcs([trip({ date: '2026-07-04' })], now, txt));
    expect(u).toContain('DTSTART;VALUE=DATE:20260704');
    expect(u).toContain('DTEND;VALUE=DATE:20260705');
    expect(u).toContain('SUMMARY:Angeln');
    expect(u).toContain('TRIGGER;VALUE=DATE-TIME:20260703T160000Z'); // 18:00 MESZ
    expect(u).not.toContain('LOCATION');
  });

  it('mehrere Termine, gelöschte nicht', () => {
    const ics = tripsToIcs([trip({ id: 'a' }), trip({ id: 'b', deletedAt: meta.createdAt })], now, txt);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('Text maskieren und lange Zeilen falten (höchstens 75 Byte, Umlaute nicht zerteilt)', () => {
    expect(icsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    const long = `DESCRIPTION:${'ä'.repeat(100)}`;
    const folded = foldLine(long);
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});
