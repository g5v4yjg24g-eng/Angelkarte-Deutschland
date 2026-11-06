// Push-Mitteilungen (Wunsch Nutzer 2026-11-04): Einstellungen je Art und das Ziel beim Antippen. Rein, ohne Netz.
import { z } from 'zod';

export const PUSH_KINDS = ['friends', 'likes', 'comments', 'spots', 'sessions'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushPrefs = Record<PushKind, boolean>;

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  friends: true,
  likes: true,
  comments: true,
  spots: true,
  sessions: true,
};

const PrefsRowSchema = z.object({
  friends: z.boolean(),
  likes: z.boolean(),
  comments: z.boolean(),
  spots: z.boolean(),
  /** Einladungen zu gemeinsamen Sessions (Paket 8a); fehlt bei älterem Server-Stand → an */
  sessions: z.boolean().optional().default(true),
});

/** Antwort von my_push_prefs (eine Zeile); fehlt sie, ist alles an */
export function parsePushPrefs(rows: readonly unknown[] | null | undefined): PushPrefs {
  const p = PrefsRowSchema.safeParse(rows?.[0]);
  return p.success ? p.data : DEFAULT_PUSH_PREFS;
}

/** APNs-Token: nur Hexziffern (so prüft es auch der Server) */
export function validPushToken(token: string): boolean {
  return /^[0-9a-f]{64,200}$/i.test(token);
}

/**
 * Ziel beim Antippen einer Mitteilung. Nur bekannte Bereiche der App – nie eine fremde Adresse, auch wenn der
 * Inhalt einer Mitteilung manipuliert wäre.
 */
export function pushTarget(data: unknown): string | undefined {
  const path = (data as { path?: unknown } | null)?.path;
  if (typeof path !== 'string') return undefined;
  if (['/profil/freunde', '/profil/spots', '/feed', '/fangbuch/sessions'].includes(path)) return path;
  if (/^\/profil\/beitrag\/[0-9a-zA-Z-]{1,100}$/.test(path)) return path;
  return undefined;
}

/** Zustand der Erlaubnis im Betriebssystem */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';
