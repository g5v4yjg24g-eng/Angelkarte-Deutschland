// GPS-Route einer laufenden Session speichern (Session-Rückblick). Jeder angenommene Punkt wird sofort geschrieben –
// schließt der Browser die App, ist nichts verloren. Die Route bleibt auf dem Gerät.
import { applyFix, decideFix, type Fix, type FixDecision } from '../domain/track';
import type { Track } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

/** Eine Route je Session; sie trägt die ID der Session. */
export const trackIdOf = (sessionId: string) => `track-${sessionId}`;

export async function getTrack(sessionId: string, db: FangpunktDB = getDb()): Promise<Track | undefined> {
  const tr = await db.tracks.get(trackIdOf(sessionId));
  return tr && !tr.deletedAt ? tr : undefined;
}

/**
 * Nimmt einen GPS-Fix entgegen. Gespeichert wird nur, was zwischen Start und Ende außerhalb von Pausen liegt.
 * `restart`: erster Fix nach Start, Pause oder Rückkehr aus dem Hintergrund → neuer Abschnitt.
 */
export async function recordFix(
  sessionId: string,
  fix: Fix,
  restart: boolean,
  db: FangpunktDB = getDb(),
): Promise<FixDecision> {
  return db.transaction('rw', db.sessions, db.tracks, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s || s.deletedAt) return { kind: 'skip', reason: 'past' } as const;
    // Punkte aus dem Puffer der iPhone-App können kurz nach Pause/Ende ankommen: zählt der Zeitpunkt des Punkts
    if (s.endAt && fix.t > Date.parse(s.endAt)) return { kind: 'skip', reason: 'past' } as const;
    const inPause = (s.pauses ?? []).some(
      (p) => fix.t >= Date.parse(p.from) && (!p.to || fix.t < Date.parse(p.to)),
    );
    if (inPause) return { kind: 'skip', reason: 'past' } as const;
    if (fix.t < Date.parse(s.startAt)) return { kind: 'skip', reason: 'past' } as const;
    const cur = await db.tracks.get(trackIdOf(sessionId));
    const segments = cur?.segments ?? [];
    const d = decideFix(segments, fix, restart);
    if (d.kind === 'skip') return d;
    const next = applyFix(segments, d);
    if (cur) await repo('tracks', db).update(cur.id, { segments: next });
    else await repo('tracks', db).create({ id: trackIdOf(sessionId), sessionId, segments: next });
    return d;
  });
}
