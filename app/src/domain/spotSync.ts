// Orte automatisch mit angenommenen Partnern teilen (Wunsch Nutzer 2026-11-12): Jeder eigene Ort geht an alle Personen,
// mit denen das Teilen angenommen ist – außer er ist abgeschaltet oder gelöscht. Der Merker je Gerät sagt, was schon
// hochgeladen ist. Rein, ohne Netz: Plan und Merker.
import type { Place } from './schemas';

export interface SpotSyncEntry {
  /** Stand des Orts, der hochgeladen wurde */
  sig: string;
  /** Personen, bei denen genau dieser Stand schon liegt */
  to: string[];
}
export type SpotSyncState = Record<string, SpotSyncEntry>;

/** Wird ein Ort geteilt? (nicht gelöscht, Schalter nicht ausgeschaltet) */
export const isShared = (p: Place): boolean => !p.deletedAt && p.sharedWithFriends !== false;

/** Was Freunde sehen: Art, Name, Notiz, Position – ändert sich eines davon, wird neu hochgeladen */
export const placeSig = (p: Place): string =>
  JSON.stringify([p.type, p.name ?? '', p.notes ?? '', p.position.lat, p.position.lng]);

export interface SpotSyncPlan {
  uploads: { place: Place; partnerId: string }[];
  /** Orte, die nicht mehr geteilt werden, aber früher hochgeladen wurden: bei allen Partnern entfernen */
  removals: string[];
}

export function planSpotSync(
  places: readonly Place[],
  partners: readonly string[],
  state: SpotSyncState,
): SpotSyncPlan {
  const uploads: SpotSyncPlan['uploads'] = [];
  for (const place of places) {
    if (!isShared(place)) continue;
    const sig = placeSig(place);
    const done = state[place.id]?.sig === sig ? state[place.id]?.to : [];
    for (const partnerId of partners) if (!done?.includes(partnerId)) uploads.push({ place, partnerId });
  }
  const shared = new Set(places.filter(isShared).map((p) => p.id));
  const removals = Object.keys(state).filter((id) => !shared.has(id));
  return { uploads, removals };
}

/** Merker nach einem Upload: genau dieser Stand liegt bei dieser Person */
export function withUploaded(state: SpotSyncState, place: Place, partnerId: string): SpotSyncState {
  const sig = placeSig(place);
  const cur = state[place.id];
  const to = cur?.sig === sig ? cur.to : [];
  return { ...state, [place.id]: { sig, to: to.includes(partnerId) ? to : [...to, partnerId] } };
}

/** Merker nach dem Entfernen eines Orts bei allen Partnern */
export function withoutPlace(state: SpotSyncState, placeId: string): SpotSyncState {
  return Object.fromEntries(Object.entries(state).filter(([id]) => id !== placeId));
}

/** Personen, mit denen nichts mehr verbunden ist, aus dem Merker nehmen (der Server hat ihre Kopien gelöscht) */
export function pruneSpotPartners(state: SpotSyncState, partners: readonly string[]): SpotSyncState {
  const keep = new Set(partners);
  return Object.fromEntries(
    Object.entries(state).map(([id, e]) => [id, { ...e, to: e.to.filter((u) => keep.has(u)) }]),
  );
}

/** Gespeicherten Merker lesen (kaputt → leer) */
export function parseSpotSyncState(raw: string | null | undefined): SpotSyncState {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: SpotSyncState = {};
    for (const [id, e] of Object.entries(v as Record<string, unknown>)) {
      const entry = e as { sig?: unknown; to?: unknown };
      if (typeof entry?.sig === 'string' && Array.isArray(entry.to))
        out[id] = { sig: entry.sig, to: entry.to.filter((x): x is string => typeof x === 'string') };
    }
    return out;
  } catch {
    return {};
  }
}
