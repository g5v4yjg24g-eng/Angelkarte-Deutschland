// Live Activity auf dem Sperrbildschirm und in der Dynamic Island (Wunsch Nutzer 2026-11-15). Die Web-App meldet
// Beginn, Änderungen und Ende der Session (Port `liveActivity`); dieses Modul zeigt sie über ActivityKit an. Nichts
// verlässt das Gerät, es gibt keine Push-Updates. Ab iOS 16.2; auf älteren Systemen meldet `isAvailable` false.
import ActivityKit
import Capacitor
import Foundation

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "FangpunktLive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise),
    ]

    /// Ein Knopf der Live Activity hat eine Aktion vorgemerkt: die Web-App holt sie mit `takeActions` ab
    override public func load() {
        NotificationCenter.default.addObserver(
            forName: .fangpunktLiveAction, object: nil, queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("liveAction", data: [:])
        }
    }

    /// Vorgemerkte Aktionen der Knöpfe (Pause, Weiter, Beenden) mit Zeitpunkt, älteste zuerst; leert die Liste
    @objc func takeActions(_ call: CAPPluginCall) {
        call.resolve(["actions": PendingLiveActions.take()])
    }

    /// Verfügbar, wenn das System Live Activities kennt und die Person sie nicht abgeschaltet hat
    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    /// Zeigt die Live Activity der Session (oder aktualisiert sie, falls sie schon läuft)
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        guard let sessionId = call.getString("sessionId"), let state = Self.state(from: call) else {
            return call.reject("bad_state")
        }
        Task {
            await Self.show(sessionId: sessionId, state: state)
            call.resolve()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        guard let sessionId = call.getString("sessionId"), let state = Self.state(from: call) else {
            return call.reject("bad_state")
        }
        Task {
            await Self.show(sessionId: sessionId, state: state)
            call.resolve()
        }
    }

    /// Beendet die Live Activity; bei `ended` bleibt die Zusammenfassung noch `keepSeconds` stehen
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        guard let sessionId = call.getString("sessionId") else { return call.reject("bad_state") }
        let state = Self.state(from: call)
        let keep = call.getDouble("keepSeconds") ?? 0
        Task {
            await Self.finish(sessionId: sessionId, state: state, keepSeconds: keep)
            call.resolve()
        }
    }

    // MARK: Hilfen

    @available(iOS 16.2, *)
    private static func state(from call: CAPPluginCall) -> FangpunktLiveAttributes.ContentState? {
        guard let kind = call.getString("state"), ["running", "paused", "ended"].contains(kind) else { return nil }
        let startMs = call.getDouble("timerStartMs") ?? Date().timeIntervalSince1970 * 1000
        return FangpunktLiveAttributes.ContentState(
            state: kind,
            timerStart: Date(timeIntervalSince1970: startMs / 1000),
            activeSeconds: max(0, call.getInt("activeSeconds") ?? 0),
            catches: max(0, call.getInt("catches") ?? 0),
            bites: max(0, call.getInt("bites") ?? 0),
            distanceKm: call.getDouble("distanceKm"),
            title: call.getString("title") ?? "",
            biggest: call.getString("biggest")
        )
    }

    @available(iOS 16.2, *)
    private static func show(sessionId: String, state: FangpunktLiveAttributes.ContentState) async {
        let content = ActivityContent(state: state, staleDate: nil)
        // Eine laufende Aktivität derselben Session nur aktualisieren, andere (Reste) beenden
        var found = false
        for activity in Activity<FangpunktLiveAttributes>.activities {
            if activity.attributes.sessionId == sessionId, !found {
                found = true
                await activity.update(content)
            } else {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        if found { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        _ = try? Activity.request(
            attributes: FangpunktLiveAttributes(sessionId: sessionId),
            content: content,
            pushType: nil
        )
    }

    @available(iOS 16.2, *)
    private static func finish(
        sessionId: String,
        state: FangpunktLiveAttributes.ContentState?,
        keepSeconds: Double
    ) async {
        for activity in Activity<FangpunktLiveAttributes>.activities where activity.attributes.sessionId == sessionId {
            let policy: ActivityUIDismissalPolicy = keepSeconds > 0
                ? .after(Date().addingTimeInterval(keepSeconds))
                : .immediate
            if let state {
                await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: policy)
            } else {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
