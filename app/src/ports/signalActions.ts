// Port für die Knöpfe „Annehmen“/„Ablehnen“ an Mitteilungen zu gemeinsamen Sessions (Wunsch Nutzer 2026-11-21). Nur in
// der iPhone-App: Das Swift-Modul merkt sich die Antwort samt Zeitpunkt, die Web-App holt sie ab und führt sie aus.
// Im Browser fehlt der Anbieter.
export interface SignalAnswer {
  /** Kennung der Meldung (session_signals.id) */
  signalId: string;
  accept: boolean;
  /** Zeitpunkt des Knopfdrucks (ms seit 1970) */
  atMs: number;
}

export interface SignalActionsProvider {
  /** Vorgemerkte Antworten abholen; leert die Liste */
  take(): Promise<SignalAnswer[]>;
  /** Ein Knopf wurde gedrückt, während die App läuft: dann `take` aufrufen; liefert die Abmeldung */
  onAnswer(listener: () => void): () => void;
}
