// Port für die Live Activity auf dem Sperrbildschirm (nur iPhone-App, ab iOS 16.2). Im Browser fehlt der Anbieter.
import type { LivePayload, PendingLiveAction } from '../domain/liveActivity';

export interface LiveActivityProvider {
  /** Kann das Gerät Live Activities zeigen (iOS-Version, in den Systemeinstellungen nicht abgeschaltet)? */
  available(): Promise<boolean>;
  /** Anzeige starten (oder die laufende derselben Session aktualisieren) */
  start(payload: LivePayload): Promise<void>;
  update(payload: LivePayload): Promise<void>;
  /** Anzeige beenden; mit `payload` bleibt die Zusammenfassung noch `keepSeconds` stehen */
  end(sessionId: string, payload: LivePayload | undefined, keepSeconds: number): Promise<void>;
  /** Vorgemerkte Aktionen der Knöpfe (Pause, Weiter, Beenden ohne App-Öffnen); leert die Liste */
  takeActions(): Promise<PendingLiveAction[]>;
  /** Ein Knopf wurde gedrückt, während die App läuft: dann `takeActions` aufrufen; liefert die Abmeldung */
  onAction(listener: () => void): () => void;
}
