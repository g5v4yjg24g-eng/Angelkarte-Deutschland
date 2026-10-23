// Zeichnet während einer laufenden Session die Route auf (Session-Rückblick). Genau ein Standort-Zuhörer für die
// ganze App; er läuft nur, solange die Session läuft, nicht pausiert ist, die Einstellung an ist und die App
// sichtbar ist. Im Hintergrund liefern Browser (vor allem iOS) keinen Standort – dort entsteht eine Lücke, die im
// Rückblick nicht überbrückt wird.
import { useEffect, useState } from 'react';
import { recordFix } from '../../../data/trackService';
import { openPause } from '../../../domain/session';
import { useBoolSetting } from '../../settings/useBoolSetting';
import { useRunningSession } from '../useSessions';
import { onRetry, setTrackStatus } from './trackStatus';

const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

export function SessionTracker() {
  const session = useRunningSession();
  const enabled = useBoolSetting('trackSessions', true);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    const off = onRetry(() => setAttempt((n) => n + 1));
    return () => {
      document.removeEventListener('visibilitychange', on);
      off();
    };
  }, []);

  // Nur ID und Pause als Auslöser: andere Änderungen an der Session (Titel, Notiz) starten die Aufzeichnung nicht neu
  const loaded = session !== undefined;
  const sessionId = session ? session.id : undefined;
  const paused = !!session && !!openPause(session);

  useEffect(() => {
    if (!loaded || enabled === undefined) return;
    if (!sessionId) return setTrackStatus({ state: 'idle', weak: false });
    if (!enabled) return setTrackStatus({ state: 'off', weak: false });
    if (paused) return setTrackStatus({ state: 'paused', weak: false });
    if (!visible) return setTrackStatus({ state: 'hidden', weak: false });
    if (!supported) return setTrackStatus({ state: 'unavailable', weak: false });

    setTrackStatus({ state: 'waiting', weak: false });
    // Neuer Abschnitt, bis der erste Punkt dieses Laufs gespeichert ist; Fixe nacheinander speichern
    let restart = true;
    let chain = Promise.resolve();
    let alive = true;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          t: p.timestamp,
        };
        chain = chain
          .then(async () => {
            if (!alive) return;
            const d = await recordFix(sessionId, fix, restart);
            if (!alive) return;
            if (d.kind !== 'skip') {
              restart = false;
              setTrackStatus({ state: 'recording', weak: false, lastFixAt: fix.t });
            } else if (d.reason === 'inaccurate') setTrackStatus({ weak: true });
            else setTrackStatus({ state: restart ? 'waiting' : 'recording', weak: false });
          })
          .catch(() => undefined);
      },
      (e) => {
        if (!alive) return;
        if (e.code === e.PERMISSION_DENIED) setTrackStatus({ state: 'denied', weak: false });
        else if (e.code === e.POSITION_UNAVAILABLE) setTrackStatus({ state: 'unavailable', weak: false });
        // Zeitüberschreitung: weiter warten, watchPosition versucht es selbst erneut
      },
      // Hohe Genauigkeit ist für eine Route am Ufer nötig; Fixe dürfen bis 5 s alt sein, Abstand regelt decideFix
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 60_000 },
    );
    return () => {
      alive = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [loaded, sessionId, enabled, paused, visible, attempt]);

  return null;
}
