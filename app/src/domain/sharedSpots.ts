// Spots teilen (Etappe 4, Wunsch Nutzer 2026-11-03): Zeilen vom Server lesen, Doppelte zusammenfassen,
// Übernahme in die eigenen Orte. Rein, ohne Netz. Position genau (Entscheidung Nutzer).
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';
import { PlaceTypeSchema, type Place, type PlaceType } from './schemas';

export interface SharedSpot {
  id: string;
  placeId: string;
  direction: 'incoming' | 'outgoing';
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  ownerBadges: Badge[];
  /** fehlt = mit allen Freunden geteilt */
  recipient?: { id: string; username: string; name: string } | undefined;
  type: PlaceType;
  name?: string | undefined;
  note?: string | undefined;
  lat: number;
  lng: number;
  updatedAt: string;
}

/** Was zum Teilen auf den Server geht – nur diese Felder eines Orts, keine Fotos, keine Gewässerzuordnung */
export interface ShareSpotInput {
  placeId: string;
  /** fehlt = alle Freunde */
  recipientId?: string | undefined;
  type: PlaceType;
  name?: string | undefined;
  note?: string | undefined;
  lat: number;
  lng: number;
}

const RowSchema = z.object({
  id: z.string(),
  place_id: z.string(),
  direction: z.enum(['incoming', 'outgoing']),
  owner_id: z.string(),
  owner_username: z.string(),
  owner_display_name: z.string(),
  owner_badges: z.array(z.unknown()).nullable().optional(),
  recipient_id: z.string().nullable().optional(),
  recipient_username: z.string().nullable().optional(),
  recipient_display_name: z.string().nullable().optional(),
  place_type: PlaceTypeSchema,
  name: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  updated_at: z.string(),
});

export function parseSharedSpotRows(rows: readonly unknown[] | null | undefined): SharedSpot[] {
  const out: SharedSpot[] = [];
  for (const r of rows ?? []) {
    const p = RowSchema.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      placeId: d.place_id,
      direction: d.direction,
      ownerId: d.owner_id,
      ownerUsername: d.owner_username,
      ownerName: d.owner_display_name,
      ownerBadges: parseBadges((d.owner_badges ?? []).map((badge) => ({ badge }))),
      recipient:
        d.recipient_id && d.recipient_username
          ? {
              id: d.recipient_id,
              username: d.recipient_username,
              name: d.recipient_display_name ?? d.recipient_username,
            }
          : undefined,
      type: d.place_type,
      name: d.name ?? undefined,
      note: d.note ?? undefined,
      lat: d.lat,
      lng: d.lng,
      updatedAt: d.updated_at,
    });
  }
  return out;
}

/**
 * Mit mir geteilt: derselbe Ort kann mich doppelt erreichen (persönlich und „alle Freunde“) –
 * dann zählt der neueste Stand. Neueste zuerst.
 */
export function incomingSpots(spots: readonly SharedSpot[]): SharedSpot[] {
  const best = new Map<string, SharedSpot>();
  for (const s of spots) {
    if (s.direction !== 'incoming') continue;
    const key = `${s.ownerId}|${s.placeId}`;
    const cur = best.get(key);
    if (!cur || s.updatedAt > cur.updatedAt) best.set(key, s);
  }
  return [...best.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Von mir geteilt, neueste zuerst; mit `placeId` nur die Freigaben dieses Orts */
export function outgoingSpots(spots: readonly SharedSpot[], placeId?: string): SharedSpot[] {
  return spots
    .filter((s) => s.direction === 'outgoing' && (placeId === undefined || s.placeId === placeId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const SAME = 1e-7;

/** Schon in die eigenen Orte übernommen? (gleiche Position – die Übernahme kopiert sie genau) */
export function adoptedPlace(spot: SharedSpot, places: readonly Place[]): Place | undefined {
  return places.find(
    (p) =>
      !p.deletedAt &&
      Math.abs(p.position.lat - spot.lat) < SAME &&
      Math.abs(p.position.lng - spot.lng) < SAME,
  );
}

/** Felder für einen eigenen Ort aus einem geteilten Spot (Notiz nennt, von wem er stammt) */
export function adoptFields(spot: SharedSpot, fromLabel: (name: string, username: string) => string) {
  const origin = fromLabel(spot.ownerName, spot.ownerUsername);
  const note = spot.note ? `${spot.note}\n\n${origin}` : origin;
  return {
    type: spot.type,
    ...(spot.name ? { name: spot.name } : {}),
    notes: note.slice(0, 2000),
    position: { lat: spot.lat, lng: spot.lng, source: 'import' as const },
  };
}

/** Eingabe zum Teilen aus einem eigenen Ort */
export function shareInput(place: Place, recipientId?: string): ShareSpotInput {
  return {
    placeId: place.id,
    ...(recipientId ? { recipientId } : {}),
    type: place.type,
    ...(place.name ? { name: place.name } : {}),
    ...(place.notes ? { note: place.notes } : {}),
    lat: place.position.lat,
    lng: place.position.lng,
  };
}

/** Fehler vom Server (share_spot/unshare_spot) → Art für den Text */
export type ShareErrorKind = 'notFriends' | 'noProfile' | 'notSignedIn' | 'offline' | 'unknown';
export function shareErrorKind(e: { message?: string; status?: number } | undefined): ShareErrorKind {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_friends')) return 'notFriends';
  if (m.includes('no_profile')) return 'noProfile';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
