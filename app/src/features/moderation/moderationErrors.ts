import { de } from '../../i18n/de';
import { moderationErrorKind } from '../../domain/moderation';

export const moderationErrorText = (e: unknown) =>
  de.moderation.errors[
    moderationErrorKind(e instanceof Error ? (e as Error & { status?: number }) : undefined)
  ];
