// Darstellung der Live Activity: Sperrbildschirm, Dynamic Island (kompakt, minimal, aufgeklappt). Die Knöpfe sind
// App Intents (iOS 17, ohne die App zu öffnen) bzw. Links auf `fangpunkt://session/…` (davor, und für „Fang erfassen“); die
// App führt die Aktion aus (LiveActivityPlugin, AppLinkHandler). Die Angelzeit
// läuft über `Text(timerInterval:)` von selbst; bei Pause und Ende steht die feste Zeit da.
import ActivityKit
import SwiftUI
import WidgetKit

private enum Palette {
    static let teal = Color(red: 0.059, green: 0.361, blue: 0.431)
    static let tealLight = Color(red: 0.071, green: 0.522, blue: 0.608)
    static let orange = Color(red: 0.949, green: 0.600, blue: 0.290)
    static let onOrange = Color(red: 0.169, green: 0.086, blue: 0.0)
    static let green = Color(red: 0.482, green: 0.878, blue: 0.631)
    static let chip = Color.white.opacity(0.12)
}

private func clock(_ seconds: Int) -> String {
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    return String(format: "%d:%02d:%02d", h, m, s)
}

private func url(_ action: String) -> URL {
    URL(string: "fangpunkt://session/\(action)") ?? URL(fileURLWithPath: "/")
}

/// Fangpunkt-Fisch als einfache Zeichnung (Marke), ohne Bilddatei
private struct FishShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width
        let h = rect.height
        p.move(to: CGPoint(x: rect.minX + 0.08 * w, y: rect.minY + 0.5 * h))
        p.addCurve(
            to: CGPoint(x: rect.minX + 0.62 * w, y: rect.minY + 0.30 * h),
            control1: CGPoint(x: rect.minX + 0.20 * w, y: rect.minY + 0.22 * h),
            control2: CGPoint(x: rect.minX + 0.46 * w, y: rect.minY + 0.16 * h)
        )
        p.addLine(to: CGPoint(x: rect.minX + 0.92 * w, y: rect.minY + 0.18 * h))
        p.addLine(to: CGPoint(x: rect.minX + 0.92 * w, y: rect.minY + 0.82 * h))
        p.addLine(to: CGPoint(x: rect.minX + 0.62 * w, y: rect.minY + 0.70 * h))
        p.addCurve(
            to: CGPoint(x: rect.minX + 0.08 * w, y: rect.minY + 0.5 * h),
            control1: CGPoint(x: rect.minX + 0.46 * w, y: rect.minY + 0.84 * h),
            control2: CGPoint(x: rect.minX + 0.20 * w, y: rect.minY + 0.78 * h)
        )
        p.closeSubpath()
        return p
    }
}

private struct FishMark: View {
    var size: CGFloat = 26
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.3)
                .fill(LinearGradient(colors: [Palette.teal, Palette.tealLight], startPoint: .topLeading, endPoint: .bottomTrailing))
            FishShape()
                .stroke(Color.white, style: StrokeStyle(lineWidth: max(1.5, size * 0.07), lineCap: .round, lineJoin: .round))
                .padding(size * 0.2)
        }
        .frame(width: size, height: size)
    }
}

/// Angelzeit: läuft von selbst, bei Pause und Ende fest
@available(iOS 16.2, *)
private struct ElapsedText: View {
    let state: FangpunktLiveAttributes.ContentState
    var body: some View {
        if state.state == "running" {
            Text(timerInterval: state.timerStart...Date.distantFuture, pauseTime: nil, countsDown: false, showsHours: true)
                .monospacedDigit()
        } else {
            Text(clock(state.activeSeconds)).monospacedDigit()
        }
    }
}

private struct StatChip: View {
    let value: String
    let label: String
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(value).font(.system(size: 16, weight: .bold)).monospacedDigit()
            Text(label).font(.system(size: 11)).opacity(0.75)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.chip, in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct ActionButton: View {
    let title: String
    let action: String
    var sessionId: String?
    var primary = false

    private var label: some View {
        Text(title)
            .font(.system(size: 14, weight: .bold))
            .frame(maxWidth: .infinity, minHeight: 32)
            .foregroundColor(primary ? Palette.onOrange : .white)
            .background(primary ? Palette.orange : Color.white.opacity(0.16), in: Capsule())
    }

    /// Ab iOS 17 führt der Knopf die Aktion aus, ohne die App zu öffnen; davor (und für „Fang erfassen“, „Rückblick“)
    /// öffnet ein Link die App, die die Aktion ausführt.
    @ViewBuilder
    var body: some View {
        if #available(iOS 17.0, *), let id = sessionId {
            switch action {
            case "pause":
                Button(intent: PauseSessionIntent(sessionId: id)) { label }.buttonStyle(.plain)
            case "resume":
                Button(intent: ResumeSessionIntent(sessionId: id)) { label }.buttonStyle(.plain)
            case "end":
                Button(intent: EndSessionIntent(sessionId: id)) { label }.buttonStyle(.plain)
            default:
                Link(destination: url(action)) { label }
            }
        } else {
            Link(destination: url(action)) { label }
        }
    }
}

@available(iOS 16.2, *)
private struct Stats: View {
    let state: FangpunktLiveAttributes.ContentState
    var body: some View {
        HStack(spacing: 8) {
            StatChip(value: "\(state.catches)", label: "Fänge")
            StatChip(value: "\(state.bites)", label: "Bisse")
            if let km = state.distanceKm {
                StatChip(value: String(format: "%.1f", km).replacingOccurrences(of: ".", with: ","), label: "km")
            }
        }
    }
}

@available(iOS 16.2, *)
private struct Buttons: View {
    let state: FangpunktLiveAttributes.ContentState
    let sessionId: String
    var body: some View {
        HStack(spacing: 8) {
            switch state.state {
            case "running":
                ActionButton(title: "Pause", action: "pause", sessionId: sessionId)
                ActionButton(title: "+ Fang erfassen", action: "catch", primary: true)
            case "paused":
                ActionButton(title: "Beenden", action: "end", sessionId: sessionId)
                ActionButton(title: "Weiter angeln", action: "resume", sessionId: sessionId, primary: true)
            default:
                ActionButton(title: "Rückblick ansehen", action: "review", primary: true)
            }
        }
    }
}

@available(iOS 16.2, *)
private struct LockScreenView: View {
    let state: FangpunktLiveAttributes.ContentState
    let sessionId: String

    private var statusText: String {
        switch state.state {
        case "running": return "Session läuft"
        case "paused": return "Pausiert"
        default: return "Session beendet"
        }
    }

    private var statusColor: Color {
        switch state.state {
        case "running": return Palette.green
        case "paused": return Palette.orange
        default: return Color.white.opacity(0.8)
        }
    }

    /// Der Sperrbildschirm lässt nur etwa 160 pt Höhe zu (sonst wird die Karte abgeschnitten): eine Kopfzeile mit
    /// Titel, Status und Zeit, darunter die Kennzahlen und die Knöpfe – alles dicht gesetzt.
    var body: some View {
        VStack(spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                FishMark(size: 24)
                VStack(alignment: .leading, spacing: 1) {
                    Text(state.title.isEmpty ? "Fangpunkt" : state.title)
                        .font(.system(size: 16, weight: .bold)).lineLimit(1)
                    HStack(spacing: 5) {
                        Circle().fill(statusColor).frame(width: 6, height: 6)
                        Text(statusLine).font(.system(size: 11.5, weight: .semibold))
                            .foregroundColor(statusColor).lineLimit(1)
                    }
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 0) {
                    Text("ANGELZEIT").font(.system(size: 9.5, weight: .medium)).tracking(0.5).opacity(0.65)
                    ElapsedText(state: state)
                        .font(.system(size: 28, weight: .bold))
                        .frame(width: 130, alignment: .trailing)
                }
            }
            if state.state != "paused" { Stats(state: state) }
            Buttons(state: state, sessionId: sessionId)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var statusLine: String {
        if state.state == "ended", let biggest = state.biggest { return "\(statusText) · Größter Fisch: \(biggest)" }
        return statusText
    }
}

@available(iOS 16.2, *)
struct FangpunktSessionLive: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FangpunktLiveAttributes.self) { context in
            LockScreenView(state: context.state, sessionId: context.attributes.sessionId)
                .activityBackgroundTint(Color(red: 0.08, green: 0.11, blue: 0.13).opacity(0.72))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(url("open"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        FishMark(size: 28)
                        if !context.state.title.isEmpty {
                            Text(context.state.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedText(state: context.state)
                        .font(.system(size: 22, weight: .bold))
                        .frame(width: 100, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        if context.state.state != "paused" { Stats(state: context.state) }
                        Buttons(state: context.state, sessionId: context.attributes.sessionId)
                    }
                }
            } compactLeading: {
                FishMark(size: 20)
            } compactTrailing: {
                ElapsedText(state: context.state)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(context.state.state == "running" ? Palette.green : Palette.orange)
                    .frame(width: 56, alignment: .trailing)
            } minimal: {
                FishMark(size: 20)
            }
            .widgetURL(url("open"))
        }
    }
}
