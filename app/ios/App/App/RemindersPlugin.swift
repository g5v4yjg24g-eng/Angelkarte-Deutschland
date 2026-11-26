// Erinnerungen als lokale Mitteilungen (Wunsch Nutzer 2026-11-16), z. B. für ablaufende Angelpapiere. Die Web-App
// berechnet den Plan (domain/papers.ts) und übergibt ihn mit `replaceAll`; dieses Modul merkt die Mitteilungen beim System
// vor (UNUserNotificationCenter). Nichts verlässt das Gerät, kein Server. Fremde Mitteilungen (z. B. Push) bleiben
// unberührt: es werden nur Einträge mit dem Präfix `fp.paper.` ersetzt.
// Langes Drücken auf eine Erinnerung (Wunsch Nutzer 2026-11-27) zeigt „Erneut in 1 Stunde erinnern“ und „Nicht mehr
// erinnern“; beides läuft im Hintergrund (ReminderActions, aufgerufen vom Empfänger in SessionSignalPlugin.swift).
import Capacitor
import Foundation
import UserNotifications

/// Knöpfe an Erinnerungen: später erneut erinnern bzw. die Erinnerungen dieses Papiers/Termins beenden
enum ReminderActions {
    static let category = "FP_REMINDER"
    static let snoozeId = "fp.reminder.snooze"
    static let stopId = "fp.reminder.stop"
    static let snoozePrefix = "fp.snooze."
    private static let dismissedKey = "fp.reminder.dismissed"

    static var actions: [UNNotificationAction] {
        [
            UNNotificationAction(identifier: snoozeId, title: "Erneut in 1 Stunde erinnern", options: []),
            UNNotificationAction(identifier: stopId, title: "Nicht mehr erinnern", options: [.destructive]),
        ]
    }

    static var categoryDefinition: UNNotificationCategory {
        UNNotificationCategory(identifier: category, actions: actions, intentIdentifiers: [], options: [])
    }

    static func dismissed() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: dismissedKey) ?? [])
    }

    private static func dismiss(_ group: String) {
        var list = UserDefaults.standard.stringArray(forKey: dismissedKey) ?? []
        if !list.contains(group) { list.append(group) }
        UserDefaults.standard.set(Array(list.suffix(200)), forKey: dismissedKey)
    }

    /// `true`, wenn es einer unserer Knöpfe war
    static func handle(_ response: UNNotificationResponse) -> Bool {
        let action = response.actionIdentifier
        guard action == snoozeId || action == stopId else { return false }
        let center = UNUserNotificationCenter.current()
        let content = response.notification.request.content
        if action == snoozeId {
            let again = UNMutableNotificationContent()
            again.title = content.title
            again.body = content.body
            again.sound = .default
            again.categoryIdentifier = category
            again.userInfo = content.userInfo
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3600, repeats: false)
            let request = UNNotificationRequest(
                identifier: snoozePrefix + UUID().uuidString, content: again, trigger: trigger
            )
            center.add(request, withCompletionHandler: nil)
        } else if let group = content.userInfo["group"] as? String {
            dismiss(group)
            center.getPendingNotificationRequests { pending in
                let ids = pending.filter { ($0.content.userInfo["group"] as? String) == group }.map { $0.identifier }
                center.removePendingNotificationRequests(withIdentifiers: ids)
            }
        }
        return true
    }
}

@objc(RemindersPlugin)
public class RemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RemindersPlugin"
    public let jsName = "FangpunktReminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "permission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "replaceAll", returnType: CAPPluginReturnPromise),
    ]

    private static let prefix = "fp.paper."

    /// `granted`, `denied` oder `prompt` (noch nicht gefragt)
    @objc func permission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: call.resolve(["status": "granted"])
            case .denied: call.resolve(["status": "denied"])
            default: call.resolve(["status": "prompt"])
            }
        }
    }

    /// Zeigt die Systemabfrage (nur beim ersten Mal; danach liefert iOS die frühere Antwort)
    @objc func request(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    /// Ersetzt alle vorgemerkten Erinnerungen dieser Art: items = [{ id, at (ms), title, body }]
    @objc func replaceAll(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let old = pending.map { $0.identifier }.filter { $0.hasPrefix(Self.prefix) }
            center.removePendingNotificationRequests(withIdentifiers: old)
            let dismissed = ReminderActions.dismissed()
            let calendar = Calendar.current
            let now = Date()
            for item in items {
                guard let id = item["id"] as? String, let at = Self.milliseconds(item["at"]) else { continue }
                let date = Date(timeIntervalSince1970: at / 1000)
                if date <= now { continue }
                let group = item["group"] as? String
                if let group, dismissed.contains(group) { continue }
                let content = UNMutableNotificationContent()
                content.title = (item["title"] as? String) ?? "Fangpunkt"
                content.body = (item["body"] as? String) ?? ""
                content.sound = .default
                content.categoryIdentifier = ReminderActions.category
                if let group { content.userInfo = ["group": group] }
                let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
                let request = UNNotificationRequest(identifier: Self.prefix + id, content: content, trigger: trigger)
                center.add(request, withCompletionHandler: nil)
            }
            call.resolve()
        }
    }

    /// Zahl aus JavaScript (je nach Brücke Double, Int oder NSNumber)
    private static func milliseconds(_ value: Any?) -> Double? {
        if let n = value as? NSNumber { return n.doubleValue }
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        return nil
    }
}
