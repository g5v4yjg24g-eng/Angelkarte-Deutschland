// Hintergrund-Route (Weg B, Wunsch Nutzer 2026-11-10): Während einer laufenden Session zeichnet die iPhone-App die
// Route auch bei gesperrtem Bildschirm auf. Nur Erlaubnis „Beim Verwenden der App“ – iOS zeigt im Hintergrund die
// blaue Standort-Anzeige. Punkte landen in einem Puffer auf dem Gerät (Datei, übersteht ein Beenden der App) und
// werden von der Web-App mit `drain` abgeholt und wie gewohnt in `tracks` gespeichert. Nichts verlässt das Gerät.
import Capacitor
import CoreLocation
import Foundation
import UIKit

/// Bridge mit den eigenen Plugins der App (Capacitor findet Plugins im App-Ziel nicht von selbst)
class FangpunktBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RoutePlugin())
    }
}

@objc(RoutePlugin)
public class RoutePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RoutePlugin"
    public let jsName = "FangpunktRoute"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    /// Höchstens so viele Punkte im Puffer (bei 10 m Abstand reicht das für über 200 km)
    private static let maxBuffered = 20_000
    private let manager = CLLocationManager()
    private let queue = DispatchQueue(label: "com.fangpunkt.route")
    private var running = false
    private var pendingStart: [CAPPluginCall] = []

    private lazy var bufferURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("route-buffer.jsonl")
    }()

    override public func load() {
        configure()
    }

    private func configure() {
        guard manager.delegate !== self else { return }
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 10
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = false
    }

    // MARK: Aufrufe aus der Web-App

    /// Startet die Aufzeichnung (fragt bei Bedarf „Beim Verwenden der App“). Antwort: { state: granted|denied|unavailable }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.configure()
            guard CLLocationManager.locationServicesEnabled() else {
                call.resolve(["state": "unavailable"])
                return
            }
            switch self.manager.authorizationStatus {
            case .notDetermined:
                self.pendingStart.append(call)
                self.manager.requestWhenInUseAuthorization()
            case .denied, .restricted:
                call.resolve(["state": "denied"])
            default:
                self.begin()
                call.resolve(["state": "granted"])
            }
        }
    }

    /// Hält die Aufzeichnung an; der Puffer bleibt, bis er abgeholt wird
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.end()
            call.resolve()
        }
    }

    /// Liefert alle gepufferten Punkte und leert den Puffer. Antwort: { fixes: [{lat,lng,acc,t}] }
    @objc func drain(_ call: CAPPluginCall) {
        queue.async {
            var fixes: [[String: Any]] = []
            if let data = try? Data(contentsOf: self.bufferURL), let text = String(data: data, encoding: .utf8) {
                for line in text.split(separator: "\n") {
                    if let obj = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] {
                        fixes.append(obj)
                    }
                }
            }
            try? FileManager.default.removeItem(at: self.bufferURL)
            call.resolve(["fixes": fixes])
        }
    }

    /// { running, permission: granted|denied|prompt }
    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["running": self.running, "permission": self.permission()])
        }
    }

    // MARK: Standort

    private func permission() -> String {
        switch manager.authorizationStatus {
        case .notDetermined: return "prompt"
        case .denied, .restricted: return "denied"
        default: return "granted"
        }
    }

    private func begin() {
        guard !running else { return }
        running = true
        // Braucht UIBackgroundModes „location“ in Info.plist; die blaue Anzeige zeigt dem Nutzer die Aufzeichnung
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
    }

    private func end() {
        guard running else { return }
        running = false
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard !pendingStart.isEmpty else {
            if permission() == "denied" { end() }
            return
        }
        let state = permission()
        if state == "prompt" { return }
        if state == "granted" { begin() }
        let calls = pendingStart
        pendingStart = []
        calls.forEach { $0.resolve(["state": state]) }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let lines = locations
            .filter { $0.horizontalAccuracy >= 0 }
            .compactMap { loc -> String? in
                let obj: [String: Any] = [
                    "lat": loc.coordinate.latitude,
                    "lng": loc.coordinate.longitude,
                    "acc": loc.horizontalAccuracy,
                    "t": Int64(loc.timestamp.timeIntervalSince1970 * 1000),
                ]
                guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
                return String(data: data, encoding: .utf8)
            }
        guard !lines.isEmpty else { return }
        queue.async { self.append(lines) }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Vorübergehende Fehler (kein Signal) ignorieren; CoreLocation versucht es selbst weiter
    }

    private func append(_ lines: [String]) {
        let text = lines.joined(separator: "\n") + "\n"
        guard let data = text.data(using: .utf8) else { return }
        if let handle = try? FileHandle(forWritingTo: bufferURL) {
            defer { try? handle.close() }
            // Puffer voll: nichts mehr anhängen (ältere Punkte bleiben erhalten)
            if let size = try? handle.seekToEnd(), size > UInt64(Self.maxBuffered * 110) { return }
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: bufferURL, options: .atomic)
        }
    }
}
