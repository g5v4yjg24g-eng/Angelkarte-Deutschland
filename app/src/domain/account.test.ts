import { describe, expect, it } from 'vitest';
import {
  accountErrorKind,
  authLinkInHash,
  displayNameValid,
  normalizeCode,
  passwordIssue,
  passwordStrength,
  resendIn,
  usernameIssue,
  validCode,
  validEmail,
} from './account';

describe('Konto-Regeln (ACC-1)', () => {
  it('E-Mail und Code', () => {
    expect(validEmail(' Max@Example.de ')).toBe(true);
    for (const bad of ['', 'max', 'max@', 'max@de', 'a b@c.de']) expect(validEmail(bad), bad).toBe(false);
    expect(normalizeCode('123 456')).toBe('123456');
    expect(validCode('123-456')).toBe(true);
    expect(validCode('12345')).toBe(false);
    expect(validCode('abcdef')).toBe(false);
  });

  it('Passwort: Länge, leicht zu erraten, nicht die E-Mail; Stärke (ACC-4)', () => {
    expect(passwordIssue('kurz')).toBe('short');
    expect(passwordIssue('x'.repeat(73))).toBe('long');
    for (const weak of ['passwort123', 'Fangpunkt2026', '1234567890', 'aaaaaaaaaaaa', 'HechtZander99'])
      expect(passwordIssue(weak), weak).toBe('common');
    expect(passwordIssue('max.mustermann!!', 'max.mustermann@example.de')).toBe('email');
    expect(passwordIssue('Zander am Abend 7')).toBeUndefined();
    expect(passwordStrength('passwort123')).toBe(0);
    expect(passwordStrength('blauerkahn')).toBe(1);
    expect(passwordStrength('Blauer Kahn 7')).toBe(3);
    expect(passwordStrength('blauer kahn am see')).toBe(3);
    expect(passwordStrength('blauerkahn7x')).toBe(2);
  });

  it('Nutzername wie in der Datenbank-Regel', () => {
    expect(usernameIssue('Hecht_Max')).toBeUndefined(); // wird klein geschrieben
    expect(usernameIssue('max.angler2')).toBeUndefined();
    expect(usernameIssue('ab')).toBe('short');
    expect(usernameIssue('a'.repeat(21))).toBe('long');
    expect(usernameIssue('1max')).toBe('start');
    expect(usernameIssue('max-angler')).toBe('chars');
    expect(usernameIssue('mäx')).toBe('chars');
    expect(usernameIssue('Admin')).toBe('reserved');
  });

  it('Anzeigename 1–40 Zeichen', () => {
    expect(displayNameValid('  Max  ')).toBe(true);
    expect(displayNameValid('   ')).toBe(false);
    expect(displayNameValid('x'.repeat(41))).toBe(false);
  });

  it('Fehler des Anbieters werden eingeordnet', () => {
    expect(accountErrorKind({ code: '23505', message: 'duplicate key value' })).toBe('usernameTaken');
    expect(accountErrorKind({ code: 'P0001', message: 'username_blocked' })).toBe('usernameTaken');
    expect(accountErrorKind({ status: 429, message: 'x' })).toBe('rateLimit');
    expect(
      accountErrorKind({ message: 'For security purposes, you can only request this after 42 seconds.' }),
    ).toBe('rateLimit');
    expect(accountErrorKind({ message: 'Token has expired or is invalid' })).toBe('invalidCode');
    expect(accountErrorKind({ message: 'Email address not authorized' })).toBe('notAuthorized');
    expect(accountErrorKind({ message: 'Failed to fetch' })).toBe('offline');
    expect(accountErrorKind({ message: 'not signed in', status: 401 })).toBe('notSignedIn');
    expect(accountErrorKind({ message: 'irgendwas' })).toBe('unknown');
    expect(accountErrorKind({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe(
      'wrongPassword',
    );
    expect(accountErrorKind({ message: 'Email not confirmed' })).toBe('notConfirmed');
    expect(accountErrorKind({ message: 'x', code: 'weak_password' })).toBe('weakPassword');
    expect(accountErrorKind({ message: 'New password should be different from the old password.' })).toBe(
      'samePassword',
    );
    expect(accountErrorKind({ message: 'x', code: 'email_exists' })).toBe('emailTaken');
  });

  it('Wartezeit bis zum nächsten Code', () => {
    expect(resendIn(undefined, 1000)).toBe(0);
    expect(resendIn(0, 1000)).toBe(59);
    expect(resendIn(0, 60_000)).toBe(0);
    expect(resendIn(5000, 4200)).toBe(60);
  });

  it('Anmelde-Link im #-Teil der Adresse erkennen', () => {
    expect(authLinkInHash('#access_token=a&refresh_token=r&type=magiclink')).toEqual({
      kind: 'session',
      type: 'other',
    });
    expect(authLinkInHash('#access_token=a&refresh_token=r&type=recovery')).toEqual({
      kind: 'session',
      type: 'recovery',
    });
    expect(authLinkInHash('#access_token=a&refresh_token=r&type=signup')).toEqual({
      kind: 'session',
      type: 'signup',
    });
    expect(
      authLinkInHash(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', reason: 'expired' });
    expect(authLinkInHash('#error=server_error')).toEqual({ kind: 'error', reason: 'other' });
    expect(authLinkInHash('')).toBeUndefined();
    expect(authLinkInHash('#abschnitt')).toBeUndefined();
  });
});
