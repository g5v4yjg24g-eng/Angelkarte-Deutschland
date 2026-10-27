# Internes Erklärvideo „Montagen“

Nur fürs Team (nicht für Social Media). Querformat 1920 × 1080, 53 s, ohne Ton.
Ergebnis: `../intern-montagen-1920x1080.mp4`. Aufbau wie `../intern-knoten`.

Inhalt: Titel → 1 Mehr → Knoten & Montagen, Umschalter → 2 Übersicht und Filter nach Angelart → 3 „Wofür?“ und Zielfische
(Carolina-Rig) → 4 Aufbau Schritt für Schritt mit Beschriftung → 5 Material, Schritte, Tipps, passende Knoten →
6 Tipp auf den Clinchknoten öffnet dessen Anleitung → Stand und offene Punkte (nach PLAN.md, Montagen 2026-10-27).
Rechts läuft eine Aufnahme der echten Live-App ohne eigene Daten.

## Neu erzeugen
```bash
node marketing/tools/record-montagen.mjs      # App-Aufnahme assets/app-montagen.mp4 (+ app-montagen.json mit Zeitpunkten)
ffmpeg -y -i marketing/videos/intern-montagen/assets/app-montagen.mp4 -frames:v 1 marketing/videos/intern-montagen/assets/app-montagen-start.png
cd marketing/videos/intern-montagen && npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../intern-montagen-1920x1080.mp4
```
In der Cloud-Umgebung vorher `PRODUCER_HEADLESS_SHELL_PATH` setzen (siehe `tools/clips-steg-render.sh`). Ändert sich die
Aufnahme, die Zeiten in `index.html` an `app-montagen.json` anpassen (Versatz 3,5 s). Nach der Gegenprüfung das Schlussbild nachziehen.
