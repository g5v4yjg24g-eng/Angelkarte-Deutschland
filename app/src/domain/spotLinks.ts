// Spots teilen mit Bestätigung (Wunsch Nutzer 2026-11-12): Man bietet einer Person das Teilen an, sie nimmt an oder lehnt
// ab; bei Annahme teilen beide alle ihre Spots miteinander. Rein, ohne Netz: Zeilen prüfen, Listen bilden.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';

export interface SpotLink {
  id: string;
  partnerId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  /** incoming = die Person bietet mir das Teilen an, outgoing = ich biete es ihr an */
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted';
  createdAt: string;
  /** Spots, die ich von der Person sehe */
  spotsFromPartner: number;
  /** Spots, die die Person von mir sieht */
  spotsToPartner: number;
  /** false, solange eine Verbindung aus der Zeit vor der Bestätigung auf meine Zustimmung wartet */
  iShare: boolean;
}

const RowSchema = z.object({
  id: z.string(),
  partner_id: z.string(),
  partner_username: z.string(),
  partner_display_name: z.string(),
  partner_badges: z.array(z.string()).nullable().optional(),
  direction: z.enum(['incoming', 'outgoing']),
  status: z.enum(['pending', 'accepted']),
  created_at: z.string(),
  spots_from_partner: z.number().int().nonnegative().nullable().optional(),
  spots_to_partner: z.number().int().nonnegative().nullable().optional(),
  i_share: z.boolean().nullable().optional(),
});

/** Zeilen vom Server prüfen; Kaputtes und Unbekanntes wird übersprungen */
export function parseSpotLinkRows(rows: readonly unknown[] | null | undefined): SpotLink[] {
  const out: SpotLink[] = [];
  for (const row of rows ?? []) {
    const p = RowSchema.safeParse(row);
    if (!p.success) continue;
    const r = p.data;
    out.push({
      id: r.id,
      partnerId: r.partner_id,
      username: r.partner_username,
      displayName: r.partner_display_name,
      badges: parseBadges((r.partner_badges ?? []).map((badge) => ({ badge }))),
      direction: r.direction,
      status: r.status,
      createdAt: r.created_at,
      spotsFromPartner: r.spots_from_partner ?? 0,
      spotsToPartner: r.spots_to_partner ?? 0,
      iShare: r.i_share !== false,
    });
  }
  return out;
}

/** Reiter „Mit dir geteilt“: bestehende Verbindungen und Angebote an mich (zum Annehmen/Ablehnen) */
export const sharedWithMe = (list: readonly SpotLink[]): SpotLink[] =>
  list.filter((l) => l.status === 'accepted' || l.direction === 'incoming');

/** Reiter „Von dir geteilt“: bestehende Verbindungen und meine Angebote, die noch auf Antwort warten */
export const sharedByMe = (list: readonly SpotLink[]): SpotLink[] =>
  list.filter((l) => l.status === 'accepted' || l.direction === 'outgoing');

/** Soll meine App meine Spots zu dieser Person hochladen? Nur bei angenommener Verbindung, der ich zugestimmt habe. */
export const uploadsTo = (list: readonly SpotLink[]): SpotLink[] =>
  list.filter((l) => l.status === 'accepted' && l.iShare);

/** Fehler der Funktionen offer/respond/end → Schlüssel für die Meldung */
export type SpotLinkError =
  'not_friends' | 'declined_recently' | 'too_many' | 'not_found' | 'no_profile' | 'unknown';

export function spotLinkErrorKind(e: unknown): SpotLinkError {
  const msg = e instanceof Error ? e.message : '';
  for (const k of ['not_friends', 'declined_recently', 'too_many', 'not_found', 'no_profile'] as const)
    if (msg.includes(k)) return k;
  return 'unknown';
}
