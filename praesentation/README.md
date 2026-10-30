# Teampräsentation Fangpunkt (Stand 30.10.2026)

| Datei | Inhalt |
|---|---|
| `Fangpunkt_Teampraesentation.pptx` | 27 Folien mit Screenshots und 7 eingebetteten Videos (Vorschaubild + Wiedergabe in PowerPoint) |
| `Fangpunkt_Teampraesentation.pdf` | PDF-Fassung (Videos dort nur als Vorschaubild) |
| `Fangpunkt_Funktionsuebersicht.xlsx` | 45 Funktionen mit Ampelstatus und Nachweis, Infrastruktur, Kostenrechnung mit Formeln, Quellen, Video-Zuordnung |
| `Fangpunkt_Medien/Screenshots/` | 52 echte Screenshots (mobil 390 px @2x, Desktop 1440 px, Dunkelmodus) |
| `Fangpunkt_Medien/Videos/` | 7 Bildschirmaufnahmen, MP4 1920 × 1080, H.264, mit Untertiteln |

## So entstanden die Aufnahmen
- Lokaler Produktionsbuild des Code-Stands `main` (da94ba6), im Browser (Chromium/Playwright) gesteuert. App-Code unverändert.
- Echte Basiskarte (OpenFreeMap), echte Gewässerdaten der veröffentlichten App, echtes Wetter (Open-Meteo) und DWD-Warnungen (Bright Sky), abgerufen am 30.10.2026.
- **Beispieldaten:** 10 Sessions und 45 Einträge am De Wittsee, ein Testprofil mit Testbild. Die GPS-Positionen der Session-Demo (Video 03) sind simuliert; Aufzeichnung und Rückblick sind die echte App. Video 03 enthält Zeitraffer (gekennzeichnet).
- Videos per Chromium-Screencast aufgezeichnet und mit FFmpeg in ein 1080p-Layout mit Untertiteln gesetzt.

## Prüfstand
- `pnpm typecheck` und `pnpm lint`: fehlerfrei.
- `pnpm test`: 420/420 Tests bestanden, aber 6 unbehandelte Fehler in `AppShell.test.tsx` („IndexedDB API missing“) → Befehl endet mit Fehlercode.
- `pnpm e2e`: 180 bestanden, 6 bewusst übersprungen. Dafür musste der installierte Chromium-Build 1243 unter dem von Playwright 1.56.1 erwarteten Namen 1194 verlinkt werden (nur Umgebung, CLAUDE.md nennt noch 1194).
- Nicht geprüft: echte Geräte (iOS/Android), Safari, Firefox.

Preise: offizielle Preisseiten, abgerufen am 30.10.2026; Werte aus Drittquellen sind als Schätzung markiert. Umrechnung mit EZB-Kurs vom 29.10.2026 (1 € = 1,1130 $).
