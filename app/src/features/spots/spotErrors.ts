import { de } from '../../i18n/de';
import { shareErrorKind } from '../../domain/sharedSpots';

export const spotErrorText = (e: unknown) =>
  de.spots.errors[shareErrorKind(e instanceof Error ? (e as Error & { status?: number }) : undefined)];
