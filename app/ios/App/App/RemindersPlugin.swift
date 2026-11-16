// Erinnerungen als lokale Mitteilungen (Wunsch Nutzer 2026-11-16), z. B. für ablaufende Angelpapiere. Die Web-App
// berechnet den Plan (domain/papers.ts) und übergibt ihn mit `replaceAll`; dieses Modul merkt die Mitteilungen beim System
// vor (UNUserNotificationCenter). Nichts verlässt das Gerät, kein Server. Fremde Mitteilungen (z. B. Push) bleiben
// unberührt: es werden nur Einträge mit dem Präfix `fp.paper.` ersetzt.
import Capacitor
import Foundation
import UserNotifications

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
            let calendar = Calendar.current
            let now = Date()
            for item in items {
                guard let id = item["id"] as? String, let at = Self.milliseconds(item["at"]) else { continue }
                let date = Date(timeIntervalSince1970: at / 1000)
                if date <= now { continue }
                let content = UNMutableNotificationContent()
                content.title = (item["title"] as? String) ?? "Fangpunkt"
                content.body = (item["body"] as? String) ?? ""
                content.sound = .default
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
