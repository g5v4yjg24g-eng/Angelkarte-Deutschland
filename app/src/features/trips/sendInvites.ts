// Termin-Einladungen verschicken und merken, wer sie schon bekommen hat (Trip.invited[].sent). Schlägt das Senden
// fehl (kein Netz), bleibt der Termin gültig; der Kalender holt die Einladung beim nächsten Öffnen nach.
import { repo } from '../../data/repository';
import type { Trip } from '../../domain/schemas';
import type { AccountProvider } from '../../ports/account';

/** Gerade unterwegs („Termin:Person“) – der Nachhol-Abgleich im Kalender darf sie nicht ein zweites Mal senden */
const inFlight = new Set<string>();

export async function sendTripInvites(
  account: AccountProvider,
  trip: Trip,
  allUserIds: readonly string[],
): Promise<boolean> {
  const keyOf = (id: string) => `${trip.id}:${id}`;
  const userIds = allUserIds.filter((id) => !inFlight.has(keyOf(id)));
  if (userIds.length === 0) return true;
  for (const id of userIds) inFlight.add(keyOf(id));
  try {
    return await send(account, trip, userIds);
  } finally {
    for (const id of userIds) inFlight.delete(keyOf(id));
  }
}

async function send(account: AccountProvider, trip: Trip, userIds: readonly string[]): Promise<boolean> {
  const water = trip.waterSnapshot?.customName ?? trip.waterSnapshot?.name;
  try {
    await account.inviteToTrip({
      trip: trip.id,
      userIds: [...userIds],
      title: trip.title,
      waterName: water,
      date: trip.date,
      from: trip.from,
      to: trip.to,
      tz: trip.tz,
    });
  } catch {
    return false;
  }
  const sent = new Set(userIds);
  await repo('trips')
    .update(trip.id, {
      invited: (trip.invited ?? []).map((i) => (sent.has(i.userId) ? { ...i, sent: true } : i)),
    })
    .catch(() => undefined);
  return true;
}
