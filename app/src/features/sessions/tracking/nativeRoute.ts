// Hintergrund-Route in der iPhone-App (Weg B): das Swift-Modul zeichnet auf und puffert, hier werden die Punkte
// regelmäßig (und bei Rückkehr in die App) abgeholt und nacheinander mit `recordFix` gespeichert.
import { recordFix } from '../../../data/trackService';
import type { FangpunktDB } from '../../../data/db';
import type { BackgroundRoute } from '../../../ports/backgroundRoute';
import { setTrackStatus } from './trackStatus';

/** Abholen, solange die App sichtbar ist */
export const DRAIN_INTERVAL_MS = 5_000;

/** Gepufferte Punkte speichern. `restart` gilt nur für den ersten gespeicherten Punkt; liefert den neuen Stand. */
export async function drainInto(
  route: BackgroundRoute,
  sessionId: string,
  restart: boolean,
  report = true,
  db?: FangpunktDB,
): Promise<boolean> {
  const fixes = await route.drain();
  for (const fix of fixes) {
    const d = await recordFix(sessionId, fix, restart, db);
    if (d.kind !== 'skip') {
      restart = false;
      if (report) setTrackStatus({ state: 'recording', weak: false, lastFixAt: fix.t });
    } else if (report && d.reason === 'inaccurate') setTrackStatus({ weak: true });
  }
  return restart;
}

/**
 * Startet die Aufzeichnung für eine laufende Session und liefert die Aufräum-Funktion. Beim Aufräumen (Pause, Ende,
 * Einstellung aus) wird angehalten und der Rest des Puffers noch dieser Session zugeordnet – `recordFix` verwirft,
 * was nach Pause oder Ende liegt.
 */
export function runNativeRoute(route: BackgroundRoute, sessionId: string): () => void {
  let alive = true;
  let restart = true;
  let chain = Promise.resolve();
  const drain = () => {
    if (document.visibilityState === 'hidden') return;
    chain = chain
      .then(async () => {
        if (alive) restart = await drainInto(route, sessionId, restart);
      })
      .catch(() => undefined);
  };

  setTrackStatus({ state: 'waiting', weak: false });
  void route.start().then((state) => {
    if (!alive) return;
    if (state === 'denied') return setTrackStatus({ state: 'denied', weak: false });
    if (state === 'unavailable') return setTrackStatus({ state: 'unavailable', weak: false });
    drain();
  });
  const timer = setInterval(drain, DRAIN_INTERVAL_MS);
  const onVisible = () => drain();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    alive = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    void chain
      .then(() => route.stop())
      .then(() => drainInto(route, sessionId, restart, false))
      .catch(() => undefined);
  };
}
