// Konto (Etappe 1, Entscheidung Nutzer 2026-10-25): freiwillig, Profil mit eindeutigem Nutzernamen. Seit 2026-11-10
// (Wunsch Nutzer) Anmeldung nur noch mit E-Mail und Passwort; Bestätigung und „Passwort vergessen?“ per Mail mit Link
// und Code (10 Minuten gültig). Reine Regeln – dieselben wie in supabase/migrations/*_profiles.sql.

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

/** Passwort: mindestens 10 Zeichen (gleiche Grenze in Supabase einstellen), höchstens 72 (Grenze von bcrypt) */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;
export type PasswordIssue = 'short' | 'long' | 'common' | 'email';

/** Häufige, leicht zu erratende Bestandteile (klein geschrieben) – ein Passwort nur aus diesen ist zu schwach */
const COMMON = [
  'passwort', 'password', 'fangpunkt', 'angeln', 'angler', 'petriheil', 'qwertz', 'qwerty', 'hallo',
  'geheim', 'abcdef', '123456', '654321', 'hecht', 'zander', 'karpfen', 'forelle', 'barsch',
];

export function passwordIssue(pw: string, email?: string): PasswordIssue | undefined {
  if (pw.length < PASSWORD_MIN) return 'short';
  if (pw.length > PASSWORD_MAX) return 'long';
  const low = pw.toLowerCase();
  const local = email ? normalizeEmail(email).split('@')[0] ?? '' : '';
  if (local.length >= 4 && low.includes(local)) return 'email';
  // nur aus häufigen Wörtern, Ziffern und Wiederholungen
  let rest = low;
  for (const w of COMMON) rest = rest.split(w).join('');
  rest = rest.replace(/[0-9]/g, '').replace(/(.)\1+/g, '$1');
  if (rest.length < 3) return 'common';
  return undefined;
}

export type PasswordStrength = 0 | 1 | 2 | 3;
/** Grobe Stärke für die Anzeige (0 = ungültig, 1 = schwach, 2 = gut, 3 = stark) – keine Garantie */
export function passwordStrength(pw: string, email?: string): PasswordStrength {
  if (passwordIssue(pw, email)) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let score = 1;
  if (pw.length >= 12 && kinds >= 2 && unique >= 6) score = 2;
  if ((pw.length >= 16 && unique >= 8) || (pw.length >= 12 && kinds >= 3 && unique >= 8)) score = 3;
  return score as PasswordStrength;
}

/** Fehlerarten, die die Ansicht unterscheidet */
export type AccountErrorKind =
  | 'offline'
  | 'rateLimit'
  | 'invalidCode'
  | 'notAuthorized'
  | 'usernameTaken'
  | 'notSignedIn'
  | 'wrongPassword'
  | 'notConfirmed'
  | 'weakPassword'
  | 'samePassword'
  | 'emailTaken'
  | 'unknown';

/** Fehler des Anbieters auf eine Fehlerart abbilden (Meldungstexte und Codes von Supabase Auth/PostgREST). */
export function accountErrorKind(
  e: { message?: string; status?: number; code?: string } | undefined,
): AccountErrorKind {
  const msg = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';
  if (code === '23505' || msg.includes('duplicate key')) return 'usernameTaken';
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'wrongPassword';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'notConfirmed';
  if (code === 'same_password' || msg.includes('should be different')) return 'samePassword';
  if (code === 'weak_password' || msg.includes('password should')) return 'weakPassword';
  if (code === 'email_exists' || msg.includes('already been registered')) return 'emailTaken';
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

export type AuthLinkResult =
  | { kind: 'session'; type: 'signup' | 'recovery' | 'email_change' | 'other' }
  | { kind: 'error'; reason: 'expired' | 'other' };

/**
 * Wertet den #-Teil der Adresse nach einem Klick auf einen Link aus der Mail aus (Bestätigung, Passwort, E-Mail) (Supabase, impliziter Ablauf):
 * Erfolg liefert access_token und refresh_token, ein Fehler error/error_code/error_description.
 */
export function authLinkInHash(hash: string): AuthLinkResult | undefined {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('access_token') && p.get('refresh_token')) {
    const type = p.get('type');
    return {
      kind: 'session',
      type: type === 'signup' || type === 'recovery' || type === 'email_change' ? type : 'other',
    };
  }
  const code = p.get('error_code') ?? p.get('error');
  if (!code) return undefined;
  const text = `${code} ${p.get('error_description') ?? ''}`.toLowerCase();
  return {
    kind: 'error',
    reason: text.includes('expired') || text.includes('invalid') ? 'expired' : 'other',
  };
}
