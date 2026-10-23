// Termine als .ics-Datei an den Kalender des Handys geben (Idee 3). Läuft über einen normalen Download:
// iOS-Safari und Android bieten dann „Zum Kalender hinzufügen“ an [A, nicht am Gerät geprüft].
import { de } from '../../i18n/de';
import type { Trip } from '../../domain/schemas';
import { tripsToIcs } from '../../domain/ics';
import { downloadBlob } from '../../lib/storage';

export function exportTrips(trips: readonly Trip[], fileName: string) {
  const ics = tripsToIcs(trips, Date.now(), {
    defaultTitle: de.calendar.icsDefaultTitle,
    reminder: de.calendar.icsReminder,
  });
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), fileName);
}
