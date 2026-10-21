// Zeitpunkte werden als ISO-8601 mit Offset gespeichert, z. B. "2026-10-21T14:05:00+02:00" (DATA_MODEL §1).
export const DEFAULT_TZ = 'Europe/Berlin';

const p2 = (n: number) => String(n).padStart(2, '0');

/** Offset der Zeitzone zum Zeitpunkt utcMs in Minuten (Berlin Sommer: +120). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcMs);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

function formatOffset(min: number): string {
  const sign = min >= 0 ? '+' : '-';
  const a = Math.abs(min);
  return `${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}

/** Zeitpunkt (ms) → ISO mit Offset der Zeitzone. */
export function toZonedIso(utcMs: number, tz: string = DEFAULT_TZ): string {
  const off = tzOffsetMinutes(utcMs, tz);
  const d = new Date(utcMs + off * 60000);
  return (
    `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}${formatOffset(off)}`
  );
}

/** Lokales Datum + Uhrzeit in einer Zeitzone → ISO mit Offset. In der Zeitumstellungs-Lücke gilt der spätere Offset. */
export function localToZonedIso(date: string, time: string, tz: string = DEFAULT_TZ): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dm || !tm) throw new Error(`Ungültiges Datum/Uhrzeit: ${date} ${time}`);
  const [y, mo, d, h, mi, se] = [dm[1], dm[2], dm[3], tm[1], tm[2], tm[3] ?? '0'].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(y, mo - 1, d, h, mi, se);
  let utc = wall - tzOffsetMinutes(wall, tz) * 60000;
  utc = wall - tzOffsetMinutes(utc, tz) * 60000;
  return toZonedIso(utc, tz);
}

export const nowIso = (tz: string = DEFAULT_TZ) => toZonedIso(Date.now(), tz);
