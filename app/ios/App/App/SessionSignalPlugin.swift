// Knöpfe „Annehmen“ und „Ablehnen“ an Mitteilungen zu gemeinsamen Sessions (Wunsch Nutzer 2026-11-21). Macht eine Person
// in einer gemeinsamen Session Pause, geht weiter oder beendet sie, kommt bei den anderen eine Mitteilung; ein langes
// Drücken am Sperrbildschirm zeigt die beiden Knöpfe. Die Antwort wird mit Zeitpunkt vorgemerkt (UserDefaults) und von der
// Web-App abgeholt (`takeAnswers`), die die eigene Session ändert. Beide Knöpfe laufen im Hintergrund, ohne die App zu öffnen.
// Nichts verlässt das Gerät. Die Kennung der Kategorie steht auch in der Edge Function `send-push`.
import Capacitor
import Foundation
import UserNotifications

extension Notification.Name {
    static let fangpunktSignalAnswer = Notification.Name("fangpunktSignalAnswer")
}

/// Vorgemerkte Antworten (älteste zuerst, höchstens 50)
enum SignalAnswerStore {
    private static let key = "fp.signal.answers"
    private static let queue = DispatchQueue(label: "com.fangpunkt.signals")

    static func add(signal: String, accept: Bool) {
        queue.sync {
            var list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
            list.append(["signal": signal, "accept": accept, "at": Int64(Date().timeIntervalSince1970 * 1000)])
            UserDefaults.standard.set(Array(list.suffix(50)), forKey: key)
        }
    }

    static func take() -> [[String: Any]] {
        queue.sync {
            let list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
            UserDefaults.standard.removeObject(forKey: key)
            return list
        }
    }
}

/// Fängt die Knöpfe ab und reicht alles andere an den bisherigen Empfänger weiter (Capacitor, Push-Plugin)
final class SignalNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let category = "SESSION_SIGNAL"
    static let acceptId = "fp.signal.accept"
    static let declineId = "fp.signal.decline"
    private static var keeper: SignalNotificationDelegate?

    private let previous: UNUserNotificationCenterDelegate?

    private init(previous: UNUserNotificationCenterDelegate?) {
        self.previous = previous
    }

    /// Knöpfe anmelden und sich als Empfänger eintragen; mehrfaches Aufrufen schadet nicht. Wird beim Start der App
    /// (auch bei einem Start im Hintergrund durch den Knopf) und nach dem Laden der Bridge aufgerufen – Capacitor setzt
    /// seinen eigenen Empfänger später, dann wird er hier umhüllt.
    static func install() {
        let center = UNUserNotificationCenter.current()
        let accept = UNNotificationAction(identifier: acceptId, title: "Annehmen", options: [])
        let decline = UNNotificationAction(identifier: declineId, title: "Ablehnen", options: [])
        let mine = UNNotificationCategory(
            identifier: category, actions: [accept, decline], intentIdentifiers: [], options: []
        )
        center.getNotificationCategories { existing in
            var all = existing.filter { $0.identifier != category }
            all.insert(mine)
            all = all.filter { $0.identifier != ReminderActions.category }
            all.insert(ReminderActions.categoryDefinition)
            center.setNotificationCategories(all)
        }
        if center.delegate is SignalNotificationDelegate { return }
        let wrapper = SignalNotificationDelegate(previous: center.delegate)
        keeper = wrapper
        center.delegate = wrapper
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let action = response.actionIdentifier
        if ReminderActions.handle(response) {
            completionHandler()
            return
        }
        if action == Self.acceptId || action == Self.declineId {
            if let signal = response.notification.request.content.userInfo["signal"] as? String {
                SignalAnswerStore.add(signal: signal, accept: action == Self.acceptId)
                NotificationCenter.default.post(name: .fangpunktSignalAnswer, object: nil)
            }
            // Die App bleibt im Hintergrund kurz wach, damit die Web-Ansicht die Antwort verarbeiten kann
            var task = UIBackgroundTaskIdentifier.invalid
            task = UIApplication.shared.beginBackgroundTask(withName: "fp.signal.answer") {
                UIApplication.shared.endBackgroundTask(task)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                completionHandler()
                if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
            }
            return
        }
        if let previous, previous.responds(to: #selector(
            UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:)
        )) {
            previous.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if let previous, previous.responds(to: #selector(
            UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:)
        )) {
            previous.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.banner, .sound])
        }
    }
}

@objc(SessionSignalPlugin)
public class SessionSignalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SessionSignalPlugin"
    public let jsName = "FangpunktSignals"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "takeAnswers", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        // Capacitor hat seinen Empfänger inzwischen gesetzt: umhüllen
        SignalNotificationDelegate.install()
        NotificationCenter.default.addObserver(
            forName: .fangpunktSignalAnswer, object: nil, queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("signalAnswer", data: [:])
        }
    }

    /// Vorgemerkte Antworten von den Knöpfen: { answers: [{ signal, accept, at }] }; leert die Liste
    @objc func takeAnswers(_ call: CAPPluginCall) {
        call.resolve(["answers": SignalAnswerStore.take()])
    }
}
