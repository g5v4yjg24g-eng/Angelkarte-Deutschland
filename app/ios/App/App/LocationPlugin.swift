// Standort im Vordergrund über CoreLocation (Wunsch Nutzer 2026-11-19: nur noch einmal nach der Erlaubnis fragen).
// Über `navigator.geolocation` fragt die Web-Ansicht bei jedem Start zusätzlich nach; CoreLocation fragt nur beim ersten
// Mal („Beim Verwenden der App“), danach merkt sich iOS die Antwort. Die Aufzeichnung der Route bei gesperrtem
// Bildschirm macht weiter RoutePlugin. Nichts verlässt das Gerät.
import Capacitor
import CoreLocation
import Foundation

@objc(LocationPlugin)
public class LocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "LocationPlugin"
    public let jsName = "FangpunktLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "permission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
    ]

    private let manager = CLLocationManager()
    /// Wartet auf die Antwort der Erlaubnis-Abfrage (granted | denied)
    private var waitingForAuth: [(String) -> Void] = []
    private var waitingForFix: [CAPPluginCall] = []

    override public func load() {
        DispatchQueue.main.async { self.manager.delegate = self }
    }

    // MARK: Aufrufe aus der Web-App

    /// { status: granted | denied | prompt } – ohne zu fragen
    @objc func permission(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["status": self.permissionState()]) }
    }

    /// Fortlaufend: Standorte kommen als Ereignis `position` { lat, lng, acc, t }, Fehler als `error` { code }.
    /// Antwort: { state: granted | denied | unavailable }
    @objc func start(_ call: CAPPluginCall) {
        let high = call.getBool("high") ?? true
        DispatchQueue.main.async {
            guard CLLocationManager.locationServicesEnabled() else {
                call.resolve(["state": "unavailable"])
                return
            }
            self.ensureAuthorization { state in
                guard state == "granted" else {
                    call.resolve(["state": state])
                    return
                }
                self.manager.desiredAccuracy = high ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
                self.manager.distanceFilter = high ? kCLDistanceFilterNone : 50
                self.manager.startUpdatingLocation()
                call.resolve(["state": "granted"])
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.manager.stopUpdatingLocation()
            call.resolve()
        }
    }

    /// Einmaliger Standort: { lat, lng, acc, t } oder Fehler `denied` / `unavailable`
    @objc func current(_ call: CAPPluginCall) {
        let high = call.getBool("high") ?? false
        DispatchQueue.main.async {
            guard CLLocationManager.locationServicesEnabled() else {
                call.reject("unavailable")
                return
            }
            self.ensureAuthorization { state in
                guard state == "granted" else {
                    call.reject(state == "denied" ? "denied" : "unavailable")
                    return
                }
                self.manager.desiredAccuracy = high ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
                self.waitingForFix.append(call)
                self.manager.requestLocation()
            }
        }
    }

    // MARK: Erlaubnis

    private func permissionState() -> String {
        switch manager.authorizationStatus {
        case .notDetermined: return "prompt"
        case .denied, .restricted: return "denied"
        default: return "granted"
        }
    }

    /// Fragt nur, wenn die Person noch nie gefragt wurde; sonst gilt die gemerkte Antwort
    private func ensureAuthorization(_ done: @escaping (String) -> Void) {
        switch permissionState() {
        case "prompt":
            waitingForAuth.append(done)
            manager.requestWhenInUseAuthorization()
        case let state:
            done(state)
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let state = permissionState()
        if state == "prompt" { return }
        let waiting = waitingForAuth
        waitingForAuth = []
        waiting.forEach { $0(state) }
        if state == "denied" { notifyListeners("error", data: ["code": "denied"]) }
    }

    // MARK: Standort

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last(where: { $0.horizontalAccuracy >= 0 }) else { return }
        let fix: [String: Any] = [
            "lat": loc.coordinate.latitude,
            "lng": loc.coordinate.longitude,
            "acc": loc.horizontalAccuracy,
            "t": Int64(loc.timestamp.timeIntervalSince1970 * 1000),
        ]
        let calls = waitingForFix
        waitingForFix = []
        calls.forEach { $0.resolve(fix) }
        notifyListeners("position", data: fix)
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let code = (error as? CLError)?.code
        // „Noch kein Standort“: CoreLocation versucht es von selbst weiter
        if code == .locationUnknown && waitingForFix.isEmpty { return }
        let reason = code == .denied ? "denied" : "unavailable"
        let calls = waitingForFix
        waitingForFix = []
        calls.forEach { $0.reject(reason) }
        if !calls.isEmpty || code == .denied { notifyListeners("error", data: ["code": reason]) }
    }
}
