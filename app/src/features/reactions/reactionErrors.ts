import { de } from '../../i18n/de';
import { reactionErrorKind } from '../../domain/reactions';

export const reactionErrorText = (e: unknown) =>
  de.reactions.errors[reactionErrorKind(e instanceof Error ? (e as Error & { status?: number }) : undefined)];
