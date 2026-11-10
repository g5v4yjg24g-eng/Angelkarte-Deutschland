// Push-Mitteilungen (Wunsch Nutzer 2026-11-04): Einstellungen je Art und das Ziel beim Antippen. Rein, ohne Netz.
import { z } from 'zod';

export const PUSH_KINDS = ['friends', 'posts', 'likes', 'comments', 'spots', 'sessions'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushPrefs = Record<PushKind, boolean>;

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  friends: true,
  likes: true,
  comments: true,
  spots: true,
  sessions: true,
  posts: true,
};

const PrefsRowSchema = z.object({
  friends: z.boolean(),
  likes: z.boolean(),
  comments: z.boolean(),
  spots: z.boolean(),
  /** Einladungen zu gemeinsamen Sessions (Paket 8a); fehlt bei älterem Server-Stand → an */
  sessions: z.boolean().optional().default(true),
  /** neue Beiträge von Freunden (2026-11-10); fehlt bei älterem Server-Stand → an */
  posts: z.boolean().optional().default(true),
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

/** Stand der Mitteilungen für das eigene Konto (my_push_status): angemeldete Geräte, letzter Test */
export interface PushStatus {
  devices: number;
  /** letzter Test: erst angefragt, dann verschickt (sentAt) – oder mit Fehler von Apple */
  test?: { at: string; sentAt?: string | undefined; error?: string | undefined } | undefined;
}

const StatusRowSchema = z.object({
  devices: z.number().int().nonnegative(),
  test_at: z.string().nullable().optional(),
  test_sent_at: z.string().nullable().optional(),
  test_error: z.string().nullable().optional(),
});

export function parsePushStatus(rows: readonly unknown[] | null | undefined): PushStatus {
  const p = StatusRowSchema.safeParse(rows?.[0]);
  if (!p.success) return { devices: 0 };
  const d = p.data;
  return {
    devices: d.devices,
    test: d.test_at
      ? { at: d.test_at, sentAt: d.test_sent_at ?? undefined, error: d.test_error ?? undefined }
      : undefined,
  };
}

/** Ergebnis des letzten Tests in Worten: wartet, angekommen bei Apple, Fehler */
export type PushTestState = 'none' | 'waiting' | 'sent' | 'error';
export function pushTestState(status: PushStatus): PushTestState {
  if (!status.test) return 'none';
  if (status.test.error) return 'error';
  return status.test.sentAt ? 'sent' : 'waiting';
}
