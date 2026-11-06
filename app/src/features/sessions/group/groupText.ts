// Texte zu Fehlern gemeinsamer Sessions (Paket 8a)
import { de } from '../../../i18n/de';
import { groupErrorKey } from '../../../domain/groupSessions';

export const groupErrorText = (e: unknown) => de.groupSessions.errors[groupErrorKey(e)];
