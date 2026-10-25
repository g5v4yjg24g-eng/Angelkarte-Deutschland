// Konto (Etappe 1, Entscheidung Nutzer 2026-10-25): freiwillig, Anmeldung per E-Mail-Code, Profil mit eindeutigem
// Nutzernamen. Reine Regeln – dieselben wie in supabase/migrations/*_profiles.sql.

export const USERNAME_RE = /^[a-z][a-z0-9_.]{2,19}$/;
export const RESERVED_USERNAMES: readonly string[] = ['admin', 'fangpunkt', 'support', 'moderator', 'system'];
export const DISPLAY_NAME_MAX = 40;
/** Supabase verschickt standardmäßig 6-stellige Codes; die Länge ist im Projekt einstellbar (6–10) */
export const CODE_RE = /^\d{6,10}$/;
/** Mindestabstand zwischen zwei Code-Anforderungen (s) – entspricht der Voreinstellung von Supabase [A] */
export const RESEND_SECONDS = 60;

export interface Profile {
  id: string;
  username: string;
  displayName: string;
}

export const normalizeEmail = (s: string) => s.trim().toLowerCase();
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(s));
/** Code ohne Leerzeichen/Bindestriche (beim Einfügen aus der E-Mail) */
export const normalizeCode = (s: string) => s.replace(/[\s-]/g, '');
export const validCode = (s: string) => CODE_RE.test(normalizeCode(s));

export const normalizeUsername = (s: string) => s.trim().toLowerCase();

export type UsernameIssue = 'short' | 'long' | 'start' | 'chars' | 'reserved';

export function usernameIssue(raw: string): UsernameIssue | undefined {
  const s = normalizeUsername(raw);
  if (s.length < 3) return 'short';
  if (s.length > 20) return 'long';
  if (!/^[a-z]/.test(s)) return 'start';
  if (!USERNAME_RE.test(s)) return 'chars';
  if (RESERVED_USERNAMES.includes(s)) return 'reserved';
  return undefined;
}

export const normalizeDisplayName = (s: string) => s.trim().replace(/\s+/g, ' ');
export const displayNameValid = (s: string) => {
  const n = normalizeDisplayName(s);
  return n.length >= 1 && n.length <= DISPLAY_NAME_MAX;
};

/** Fehlerarten, die die Ansicht unterscheidet */
export type AccountErrorKind =
  'offline' | 'rateLimit' | 'invalidCode' | 'notAuthorized' | 'usernameTaken' | 'notSignedIn' | 'unknown';

/** Fehler des Anbieters auf eine Fehlerart abbilden (Meldungstexte und Codes von Supabase Auth/PostgREST). */
export function accountErrorKind(
  e: { message?: string; status?: number; code?: string } | undefined,
): AccountErrorKind {
  const msg = (e?.message ?? '').toLowerCase();
  if (e?.code === '23505' || msg.includes('duplicate key')) return 'usernameTaken';
  if (e?.status === 429 || msg.includes('rate limit') || msg.includes('only request this after'))
    return 'rateLimit';
  if (msg.includes('expired') || msg.includes('invalid') || e?.code === 'otp_expired') return 'invalidCode';
  if (msg.includes('not authorized')) return 'notAuthorized';
  if (msg.includes('fetch') || msg.includes('network')) return 'offline';
  if (e?.status === 401 || msg.includes('jwt') || msg.includes('not signed in')) return 'notSignedIn';
  return 'unknown';
}

/** Restsekunden bis zur nächsten Code-Anforderung */
export function resendIn(lastSentMs: number | undefined, nowMs: number): number {
  if (lastSentMs === undefined) return 0;
  // „jetzt“ kann eine Sekunde hinter dem Sendezeitpunkt liegen (Uhr der Ansicht) – nie mehr als die Sperrzeit
  return Math.min(
    RESEND_SECONDS,
    Math.max(0, Math.ceil((lastSentMs + RESEND_SECONDS * 1000 - nowMs) / 1000)),
  );
}

export type AuthLinkResult = { kind: 'session' } | { kind: 'error'; reason: 'expired' | 'other' };

/**
 * Wertet den #-Teil der Adresse nach einem Klick auf den Anmelde-Link aus (Supabase, impliziter Ablauf):
 * Erfolg liefert access_token und refresh_token, ein Fehler error/error_code/error_description.
 */
export function authLinkInHash(hash: string): AuthLinkResult | undefined {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('access_token') && p.get('refresh_token')) return { kind: 'session' };
  const code = p.get('error_code') ?? p.get('error');
  if (!code) return undefined;
  const text = `${code} ${p.get('error_description') ?? ''}`.toLowerCase();
  return {
    kind: 'error',
    reason: text.includes('expired') || text.includes('invalid') ? 'expired' : 'other',
  };
}
