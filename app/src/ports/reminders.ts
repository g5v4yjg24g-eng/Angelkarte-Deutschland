// Port für Erinnerungen auf dem Gerät (lokale Mitteilungen) – nur in der iPhone-App, z. B. für ablaufende Angelpapiere
// (Wunsch Nutzer 2026-11-16). Nichts verlässt das Gerät. Im Browser fehlt der Anbieter: dort zeigt die App den Hinweis
// beim Öffnen.
import type { Reminder } from '../domain/papers';

export type ReminderPermission = 'granted' | 'denied' | 'prompt';

export interface RemindersProvider {
  /** Stand der Erlaubnis für Mitteilungen */
  permission(): Promise<ReminderPermission>;
  /** Erlaubnis erfragen (zeigt die Systemabfrage nur beim ersten Mal); `true` = erlaubt */
  request(): Promise<boolean>;
  /** Alle geplanten Erinnerungen dieser Art durch diese Liste ersetzen (leer = alle löschen) */
  replaceAll(items: readonly Reminder[]): Promise<void>;
}
