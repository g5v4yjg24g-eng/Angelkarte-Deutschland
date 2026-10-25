# Internes Erklärvideo „Knoten“

Nur für Kollegen (nicht für Social Media). Querformat 1920 × 1080, 54 s, ohne Ton.
Ergebnis: `../intern-knoten-1920x1080.mp4`.

Inhalt: Titel → 1 Mehr → Knoten → 2 Übersicht und Filter → 3 Animation (Verbesserter Clinchknoten, Abspielen, Anhalten,
Schritt zurück) → 4 Schrittliste antippen → 5 Tipps → Stand und offene Punkte (nach PLAN.md, Knoten-Pilot 2026-10-25).
Rechts läuft eine Aufnahme der echten Live-App ohne eigene Daten.

## Neu erzeugen
```bash
node marketing/tools/record-knoten.mjs        # App-Aufnahme assets/app-knoten.mp4 (+ app-knoten.json mit Zeitpunkten)
ffmpeg -y -i marketing/videos/intern-knoten/assets/app-knoten.mp4 -frames:v 1 marketing/videos/intern-knoten/assets/app-knoten-start.png
cd marketing/videos/intern-knoten && npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../intern-knoten-1920x1080.mp4
```
In der Cloud-Umgebung vorher `PRODUCER_HEADLESS_SHELL_PATH` auf den vorinstallierten Headless-Chromium setzen (siehe
`tools/clips-steg-render.sh`). Ändert sich die Aufnahme, die Zeiten in `index.html` an `app-knoten.json` anpassen (Versatz 3,5 s).
Stand der Inhalte bei Änderungen am Knoten-Bereich (neue animierte Knoten, Gegenprüfung) im Schlussbild nachziehen.
