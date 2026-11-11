// Kalender-Abgleich für Termine mit Eingeladenen: fehlende Einladungen nachholen (Netz fehlte beim Speichern) und
// die Antworten (zugesagt/abgesagt) holen. Nur mit Konto und Verbindung; Fehler stören den Kalender nie.
import { useEffect, useRef, useState } from 'react';
import type { Trip } from '../../domain/schemas';
import { unsentInvitees, type TripReply } from '../../domain/tripInvites';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { sendTripInvites } from './sendInvites';

export function useTripSync(trips: readonly Trip[], today: string): TripReply[] {
  const { account } = useProviders();
  const online = useOnline();
  const signedIn = account.enabled && !!storedUserId();
  const [replies, setReplies] = useState<TripReply[]>([]);
  const tried = useRef(new Set<string>());
  // nur ein neuer Abgleich, wenn sich die Menge der Termine mit Eingeladenen ändert
  const ids = trips
    .filter((x) => (x.invited?.length ?? 0) > 0)
    .map((x) => `${x.id}:${x.invited?.filter((i) => i.sent).length ?? 0}`)
    .join('|');

  useEffect(() => {
    if (!signedIn || !online) return;
    let live = true;
    void (async () => {
      for (const trip of trips) {
        if (trip.date < today || tried.current.has(trip.id)) continue;
        const open = unsentInvitees(trip);
        if (open.length === 0) continue;
        tried.current.add(trip.id);
        await sendTripInvites(
          account,
          trip,
          open.map((i) => i.userId),
        );
      }
      const withInvited = trips.filter((x) => (x.invited?.length ?? 0) > 0).map((x) => x.id);
      if (withInvited.length === 0) return;
      const list = await account.tripInviteStatuses(withInvited).catch(() => undefined);
      if (live && list) setReplies(list);
    })();
    return () => {
      live = false;
    };
    // `trips` steckt in `ids`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, signedIn, online, ids, today]);

  return replies;
}
