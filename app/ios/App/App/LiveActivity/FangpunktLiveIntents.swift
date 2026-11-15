// Knöpfe der Live Activity ohne die App zu öffnen (Wunsch Nutzer 2026-11-15, iOS 17): Pause, Weiter angeln und Beenden
// laufen als App Intents. Diese Datei gehört zu BEIDEN Zielen (die Erweiterung zeigt die Knöpfe, die App führt sie aus).
// Ablauf: Der Intent ändert die Anzeige sofort (Zähler anhalten/fortsetzen, „beendet“), merkt die Aktion samt Zeitpunkt
// vor und weckt die Web-App; sie führt sie wirklich aus (Session pausieren/beenden, gemeinsame Session beenden) und
// holt die vorgemerkten Aktionen auch später ab, falls die App gerade nicht lief.
import ActivityKit
import AppIntents
import Foundation

extension Notification.Name {
    /// Es liegt eine neue Aktion bereit (das Plugin meldet es der Web-App)
    static let fangpunktLiveAction = Notification.Name("com.fangpunkt.liveAction")
}

/// Vorgemerkte Aktionen der Knöpfe, bis die Web-App sie abholt (nur im Speicher der App, nichts verlässt das Gerät)
enum PendingLiveActions {
    private static let key = "fangpunkt.pendingLiveActions"
    private static let lock = NSLock()

    static func append(action: String, sessionId: String, at date: Date) {
        lock.lock()
        defer { lock.unlock() }
        var list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
        list.append(["action": action, "sessionId": sessionId, "atMs": date.timeIntervalSince1970 * 1000])
        UserDefaults.standard.set(Array(list.suffix(20)), forKey: key)
    }

    /// Holt alle vorgemerkten Aktionen ab (älteste zuerst) und leert die Liste
    static func take() -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        let list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
        UserDefaults.standard.removeObject(forKey: key)
        return list
    }
}

@available(iOS 17.0, *)
enum LiveActionRunner {
    static func run(_ action: String, sessionId: String) async {
        let now = Date()
        for activity in Activity<FangpunktLiveAttributes>.activities where activity.attributes.sessionId == sessionId {
            var s = activity.content.state
            switch action {
            case "pause":
                guard s.state == "running" else { continue }
                s.activeSeconds = max(0, Int(now.timeIntervalSince(s.timerStart)))
                s.state = "paused"
            case "resume":
                guard s.state == "paused" else { continue }
                s.timerStart = now.addingTimeInterval(-Double(s.activeSeconds))
                s.state = "running"
            case "end":
                guard s.state != "ended" else { continue }
                if s.state == "running" { s.activeSeconds = max(0, Int(now.timeIntervalSince(s.timerStart))) }
                s.state = "ended"
            default:
                continue
            }
            // Nur aktualisieren: Die Web-App beendet die Anzeige danach mit der Zusammenfassung (größter Fisch)
            await activity.update(ActivityContent(state: s, staleDate: nil))
        }
        PendingLiveActions.append(action: action, sessionId: sessionId, at: now)
        NotificationCenter.default.post(name: .fangpunktLiveAction, object: nil)
    }
}

@available(iOS 17.0, *)
struct PauseSessionIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Session pausieren"
    @Parameter(title: "Session") var sessionId: String

    init() {}
    init(sessionId: String) { self.sessionId = sessionId }

    func perform() async throws -> some IntentResult {
        await LiveActionRunner.run("pause", sessionId: sessionId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct ResumeSessionIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Weiter angeln"
    @Parameter(title: "Session") var sessionId: String

    init() {}
    init(sessionId: String) { self.sessionId = sessionId }

    func perform() async throws -> some IntentResult {
        await LiveActionRunner.run("resume", sessionId: sessionId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct EndSessionIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Session beenden"
    @Parameter(title: "Session") var sessionId: String

    init() {}
    init(sessionId: String) { self.sessionId = sessionId }

    func perform() async throws -> some IntentResult {
        await LiveActionRunner.run("end", sessionId: sessionId)
        return .result()
    }
}
