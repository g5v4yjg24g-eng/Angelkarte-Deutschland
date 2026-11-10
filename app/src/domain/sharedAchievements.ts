// Erfolge im Profil anderer (Paket B, Wunsch Nutzer 2026-11-10): Erfolge werden weiter auf dem Gerät berechnet;
// auf den Server kommen nur Stufe und Datum. Wer sie sieht, wählt jede Person selbst (Server prüft, App zeigt nur an).
import { FAMILIES, FIRST_KEY, TIERS, tierKey, type Unlocked } from './achievements';

export const ACH_VISIBILITIES = ['friends', 'public', 'private'] as const;
export type AchVisibility = (typeof ACH_VISIBILITIES)[number];
export const isAchVisibility = (v: unknown): v is AchVisibility =>
  typeof v === 'string' && (ACH_VISIBILITIES as readonly string[]).includes(v);

const VALID_KEYS = new Set([FIRST_KEY, ...FAMILIES.flatMap((f) => TIERS.map((t) => tierKey(f.id, t)))]);

/** Was hochgeladen wird: nur bekannte Stufen mit gültigem Datum (der Server prüft dasselbe) */
export function uploadEntries(u: Unlocked): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(u)) if (VALID_KEYS.has(k) && !Number.isNaN(Date.parse(v))) out[k] = v;
  return out;
}

/** Merker je Konto: welche Stufen schon oben sind (der Server nimmt nur dazu, Daten ändern sich nicht) */
export const uploadKey = (userId: string, entries: Record<string, string>) =>
  `${userId}|${Object.keys(entries).sort().join(',')}`;

export type RemoteAchievements = { visible: false } | { visible: true; unlocked: Unlocked };

/** Antwort von user_achievements(author): leer = Konto unbekannt (wie verborgen), visible=false = nicht freigegeben */
export function parseRemoteAchievements(rows: unknown[] | null): RemoteAchievements {
  const list = (rows ?? []).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  if (!list.length || list.some((r) => r.visible !== true)) return { visible: false };
  const unlocked: Record<string, string> = {};
  for (const r of list)
    if (typeof r.key === 'string' && VALID_KEYS.has(r.key) && typeof r.unlocked_at === 'string')
      unlocked[r.key] = r.unlocked_at;
  return { visible: true, unlocked };
}
