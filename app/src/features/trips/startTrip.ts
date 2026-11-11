// Termin starten (Ersteller): legt auf dem Server die gemeinsame Session an, die Eingeladenen bekommen die
// Start-Anfrage – die eigene Session beginnt erst, wenn jemand bestätigt (TripStartHost). Hier nur der erste Schritt.
import { getDb } from '../../data/db';
import { runningSession } from '../../domain/session';
import type { Trip } from '../../domain/schemas';
import type { AccountProvider } from '../../ports/account';
import { writePending } from './pendingStart';

export class TripStartBusyError extends Error {
  override name = 'TripStartBusyError';
}

export async function startTripWithInvitees(account: AccountProvider, trip: Trip): Promise<void> {
  const invited = trip.invited ?? [];
  if (invited.length === 0) throw new Error('no_invitees');
  // läuft schon eine eigene Session, gibt es nichts zu starten
  if (runningSession(await getDb().sessions.toArray())) throw new TripStartBusyError('running');
  const water = trip.waterSnapshot?.customName ?? trip.waterSnapshot?.name;
  const title = trip.title ?? water;
  const groupId = await account.startTripSession({
    title,
    waterName: water,
    userIds: invited.map((i) => i.userId),
  });
  writePending({ groupId, title, names: invited.map((i) => i.name), since: Date.now() });
}
