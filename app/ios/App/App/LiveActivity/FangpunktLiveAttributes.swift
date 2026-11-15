// Live Activity „Session“ (Wunsch Nutzer 2026-11-15): gemeinsame Datenform für die App und die Widget-Erweiterung
// FangpunktLive. Diese Datei gehört zu BEIDEN Zielen. Die Web-App liefert die Zahlen (LiveActivityPlugin.swift);
// die Angelzeit läuft von selbst über `timerStart`, bei Pause und Ende zeigt das Widget `activeSeconds`.
import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct FangpunktLiveAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// "running" | "paused" | "ended"
        var state: String
        /// Zeitpunkt, ab dem die Angelzeit läuft (jetzt minus Angelzeit); nur bei "running" maßgeblich
        var timerStart: Date
        /// Angelzeit in Sekunden (angezeigt bei Pause und Ende)
        var activeSeconds: Int
        var catches: Int
        var bites: Int
        /// Strecke in km; fehlt ohne Route
        var distanceKm: Double?
        /// Gewässername oder „Angeltag“; leer = nicht zeigen
        var title: String
        /// Nur nach dem Ende: größter Fisch, z. B. „Hecht 74 cm“
        var biggest: String?
    }

    var sessionId: String
}
