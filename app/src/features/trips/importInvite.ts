// Termin aus einer Einladung auf diesem Gerät anlegen (gleiche ID wie beim Ersteller), falls es ihn nicht gibt.
// Gemeinsam für den Kalender (Einladungen) und die Mitteilungen.
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { tripFromInvite, type TripInvite } from '../../domain/tripInvites';

export async function importInvite(i: TripInvite) {
  const known = await getDb().trips.get(i.tripId);
  if (!known) await repo('trips').create(tripFromInvite(i));
}
