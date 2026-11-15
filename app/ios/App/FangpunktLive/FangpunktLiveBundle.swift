// Widget-Erweiterung „FangpunktLive“: enthält nur die Live Activity der Session (kein Home-Bildschirm-Widget).
import SwiftUI
import WidgetKit

@main
struct FangpunktLiveBundle: WidgetBundle {
    var body: some Widget {
        FangpunktSessionLive()
    }
}
