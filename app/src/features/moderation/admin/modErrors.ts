import { de } from '../../../i18n/de';
import { modErrorKind } from '../../../domain/modAdmin';

export const modErrorText = (e: unknown) =>
  de.modAdmin.errors[modErrorKind(e instanceof Error ? (e as Error & { status?: number }) : undefined)];

export const modDate = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });
