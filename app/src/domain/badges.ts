// Abzeichen (Wunsch Nutzer 2026-11-03): vergeben werden sie nur auf dem Server (Tabelle user_badges, keine
// Schreibrechte für Nutzer). Die App merkt sich das zuletzt vom Server gelesene Ergebnis je Nutzer-ID, damit das
// Abzeichen auch ohne Netz erscheint – maßgeblich bleibt der Server. Rein, ohne Speicher-Zugriff.
import { z } from 'zod';

export const BADGES = ['founder'] as const;
export type Badge = (typeof BADGES)[number];

export const BadgeSchema = z.enum(BADGES);

/** Antwort des Servers: unbekannte Werte fallen weg, doppelte auch */
export function parseBadges(rows: readonly { badge?: unknown }[] | null | undefined): Badge[] {
  const out = new Set<Badge>();
  for (const r of rows ?? []) {
    const p = BadgeSchema.safeParse(r?.badge);
    if (p.success) out.add(p.data);
  }
  return [...out];
}

export const BadgeCacheSchema = z.object({
  userId: z.string().min(1),
  badges: z.array(BadgeSchema),
  checkedAt: z.number(),
});
export type BadgeCache = z.infer<typeof BadgeCacheSchema>;

/** Gespeicherten Stand lesen; Kaputtes oder Fremdes zählt als „keine Abzeichen“ */
export function readBadgeCache(raw: string | null | undefined): BadgeCache | undefined {
  if (!raw) return undefined;
  try {
    const p = BadgeCacheSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : undefined;
  } catch {
    return undefined;
  }
}

/** Abzeichen nur für die Nutzer-ID, zu der sie gelesen wurden (Kontowechsel auf demselben Gerät) */
export function badgesFor(cache: BadgeCache | undefined, userId: string | undefined): Badge[] {
  return cache && userId && cache.userId === userId ? cache.badges : [];
}

export const hasBadge = (badges: readonly Badge[], b: Badge) => badges.includes(b);
