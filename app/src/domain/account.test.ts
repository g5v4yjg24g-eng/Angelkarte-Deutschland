import { describe, expect, it } from 'vitest';
import {
  accountErrorKind,
  displayNameValid,
  normalizeCode,
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
    expect(accountErrorKind({ status: 429, message: 'x' })).toBe('rateLimit');
    expect(
      accountErrorKind({ message: 'For security purposes, you can only request this after 42 seconds.' }),
    ).toBe('rateLimit');
    expect(accountErrorKind({ message: 'Token has expired or is invalid' })).toBe('invalidCode');
    expect(accountErrorKind({ message: 'Email address not authorized' })).toBe('notAuthorized');
    expect(accountErrorKind({ message: 'Failed to fetch' })).toBe('offline');
    expect(accountErrorKind({ message: 'not signed in', status: 401 })).toBe('notSignedIn');
    expect(accountErrorKind({ message: 'irgendwas' })).toBe('unknown');
  });

  it('Wartezeit bis zum nächsten Code', () => {
    expect(resendIn(undefined, 1000)).toBe(0);
    expect(resendIn(0, 1000)).toBe(59);
    expect(resendIn(0, 60_000)).toBe(0);
    expect(resendIn(5000, 4200)).toBe(60);
  });
});
