// Angeltermine als Kalenderdatei (.ics, RFC 5545) für den Kalender des Handys (Idee 3, Wunsch Nutzer 2026-10-22).
// Rein: Text erzeugen. Zeiten in UTC (…Z), damit jeder Kalender sie ohne Zeitzonen-Block richtig liest.
import type { Trip } from './schemas';
import { localToZonedIso } from './time';
import { addDays } from './trip';

/** Erinnerung vor einem Termin mit Uhrzeit (min); ganztägige: am Vorabend um 18 Uhr */
export const REMIND_BEFORE_MIN = 60;
export const ALLDAY_REMIND_TIME = '18:00';

const p2 = (n: number) => String(n).padStart(2, '0');
const utc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
};
const dateOnly = (date: string) => date.replaceAll('-', '');

/** Text-Werte maskieren (RFC 5545 §3.3.11) */
export const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Zeilen über 75 Byte falten (RFC 5545 §3.1); UTF-8-Zeichen werden nicht zerteilt */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // Folgezeilen beginnen mit einem Leerzeichen
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export interface IcsTexts {
  /** Titel, wenn der Termin keinen hat, z. B. „Angeln“ */
  defaultTitle: string;
  /** Erinnerungstext */
  reminder: string;
}

function vevent(t: Trip, nowMs: number, txt: IcsTexts): string[] {
  const water = [t.waterSnapshot?.name ?? t.waterSnapshot?.customName, t.waterSnapshot?.place]
    .filter(Boolean)
    .join(', ');
  const summary = t.title ?? (water ? `${txt.defaultTitle}: ${water}` : txt.defaultTitle);
  const lines = ['BEGIN:VEVENT', `UID:${t.id}@fangpunkt`, `DTSTAMP:${utc(nowMs)}`];
  if (t.from) {
    const start = Date.parse(localToZonedIso(t.date, t.from, t.tz));
    const end = t.to ? Date.parse(localToZonedIso(t.date, t.to, t.tz)) : start + 3_600_000;
    lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(t.date)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(t.date, 1))}`);
  }
  lines.push(`SUMMARY:${icsText(summary)}`);
  if (water) lines.push(`LOCATION:${icsText(water)}`);
  const c = t.waterSnapshot?.centroid;
  if (c) lines.push(`GEO:${c.lat.toFixed(5)};${c.lng.toFixed(5)}`);
  if (t.notes) lines.push(`DESCRIPTION:${icsText(t.notes)}`);
  const trigger = t.from
    ? `TRIGGER:-PT${REMIND_BEFORE_MIN}M`
    : `TRIGGER;VALUE=DATE-TIME:${utc(Date.parse(localToZonedIso(addDays(t.date, -1), ALLDAY_REMIND_TIME, t.tz)))}`;
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(txt.reminder)}`, trigger, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}

/** Kalenderdatei für einen oder mehrere Termine (gelöschte entfallen). */
export function tripsToIcs(trips: readonly Trip[], nowMs: number, txt: IcsTexts): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fangpunkt//Angelkalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const t of trips) if (!t.deletedAt) lines.push(...vevent(t, nowMs, txt));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
