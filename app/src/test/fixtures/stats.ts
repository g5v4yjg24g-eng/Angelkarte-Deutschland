// Statistik-Testdaten mit bekannten Sollwerten (TEST_PLAN §2). Ausgedacht, aber nur als Testeingabe.
import type { Catch, CatchOutcome, Session } from '../../domain/schemas';

const meta = { createdAt: '2026-06-01T05:00:00+02:00', updatedAt: '2026-06-01T05:00:00+02:00', rev: 0 };

export function session(
  id: string,
  startAt: string,
  endAt: string | undefined,
  over: Partial<Session> = {},
): Session {
  return { id, ...meta, startAt, ...(endAt ? { endAt } : {}), tz: 'Europe/Berlin', ...over };
}

let n = 0;
export function entry(outcome: CatchOutcome, at: string, over: Partial<Catch> = {}): Catch {
  n++;
  return { id: `c${n}`, ...meta, outcome, at, tz: 'Europe/Berlin', ...over };
}

/**
 * stats-basic: 3 Sessions (2 h, 4 h, 30 min), 7 Fänge, 3 Kontakte, 2 Fehlbisse, 1 Beobachtung.
 * Soll: Landequote 7/10, Fänge pro Stunde 7/6,5.
 */
export function statsBasic() {
  const sessions = [
    session('s1', '2026-06-01T05:00:00+02:00', '2026-06-01T07:00:00+02:00', { title: 'Morgens' }),
    session('s2', '2026-06-08T16:00:00+02:00', '2026-06-08T20:00:00+02:00'),
    session('s3', '2026-07-02T19:00:00+02:00', '2026-07-02T19:30:00+02:00'),
  ];
  const at = (s: Session, min: number) =>
    new Date(Date.parse(s.startAt) + min * 60000).toISOString().replace('.000Z', '+00:00');
  const [s1, s2, s3] = sessions as [Session, Session, Session];
  const wittsee = { waterSnapshot: { name: 'De Wittsee' }, waterId: 'osm:w35044256' };
  const catches = [
    entry('caught', at(s1, 10), {
      sessionId: 's1',
      speciesId: 'zander',
      lengthCm: 62,
      lengthMethod: 'measured',
      bait: { name: 'Gummifisch 12 cm' },
      method: 'jigging',
      ...wittsee,
    }),
    entry('caught', at(s1, 50), {
      sessionId: 's1',
      speciesId: 'zander',
      lengthCm: 48,
      lengthMethod: 'measured',
      bait: { name: 'Gummifisch 12 cm' },
      method: 'jigging',
      ...wittsee,
    }),
    entry('caught', at(s2, 20), {
      sessionId: 's2',
      speciesId: 'perch',
      lengthCm: 31,
      lengthMethod: 'estimated',
      bait: { name: 'Spinner Gr. 3' },
      method: 'spinning',
    }),
    entry('caught', at(s2, 60), {
      sessionId: 's2',
      speciesId: 'perch',
      lengthCm: 28,
      lengthMethod: 'measured',
      bait: { name: 'Spinner Gr. 3' },
      method: 'spinning',
    }),
    entry('caught', at(s2, 120), {
      sessionId: 's2',
      speciesId: 'pike',
      lengthCm: 74,
      lengthMethod: 'estimated',
      bait: { name: 'Wobbler' },
      method: 'spinning',
    }),
    entry('caught', at(s2, 200), { sessionId: 's2', speciesId: 'perch', method: 'spinning' }),
    entry('caught', at(s3, 15), { sessionId: 's3', speciesId: 'zander', ...wittsee }),
    entry('contact', at(s1, 30), { sessionId: 's1', bait: { name: 'Gummifisch 12 cm' }, ...wittsee }),
    entry('contact', at(s2, 90), { sessionId: 's2', bait: { name: 'Wobbler' } }),
    entry('contact', at(s3, 20), { sessionId: 's3' }),
    entry('missed_bite', at(s2, 30), { sessionId: 's2' }),
    entry('missed_bite', at(s2, 150), { sessionId: 's2' }),
    entry('observation', at(s1, 5), { sessionId: 's1', speciesId: 'asp' }),
  ];
  return { sessions, catches };
}
