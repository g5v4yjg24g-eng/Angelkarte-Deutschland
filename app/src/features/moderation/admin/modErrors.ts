import { de } from '../../../i18n/de';
import { modErrorKind, type BanDuration } from '../../../domain/modAdmin';
import type { AccountProvider } from '../../../ports/account';

export const modErrorText = (e: unknown) =>
  de.modAdmin.errors[modErrorKind(e instanceof Error ? (e as Error & { status?: number }) : undefined)];

export const modDate = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });

/** Falsches Passwort bei der Bestätigung einer dauerhaften Sperre */
export class WrongPasswordError extends Error {}

/**
 * Sperren; dauerhaft vorher mit dem Passwort neu anmelden – der Server prüft, dass die Passwort-Anmeldung höchstens
 * 5 Minuten alt ist (Schutz, falls ein Moderatorenkonto in falsche Hände gerät).
 */
export async function banUser(
  account: Pick<AccountProvider, 'verifyPassword' | 'modBan'>,
  userId: string,
  days: BanDuration,
  reason: string,
  password: string | undefined,
  reportId?: string,
) {
  if (days === null) {
    if (!password || !(await account.verifyPassword(password))) throw new WrongPasswordError();
  }
  await account.modBan(userId, days, reason, reportId);
}

/** Fehlertext einer Aktion, auch für das falsche Passwort */
export const modActionErrorText = (e: unknown) =>
  e instanceof WrongPasswordError ? de.modAdmin.reauth.wrong : modErrorText(e);
