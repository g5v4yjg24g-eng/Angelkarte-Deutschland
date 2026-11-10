// Termine als .ics-Datei an den Kalender des Handys geben (Idee 3). Im Browser ein normaler Download (iOS-Safari und
// Android bieten dann „Zum Kalender hinzufügen“ an), in der iPhone-App das Teilen-Menü (Paket 10) [A, am Gerät prüfen].
import { de } from '../../i18n/de';
import type { Trip } from '../../domain/schemas';
import { tripsToIcs } from '../../domain/ics';
import { saveFile } from '../../lib/share';

export function exportTrips(trips: readonly Trip[], fileName: string) {
  const ics = tripsToIcs(trips, Date.now(), {
    defaultTitle: de.calendar.icsDefaultTitle,
    reminder: de.calendar.icsReminder,
  });
  return saveFile(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), fileName);
}
