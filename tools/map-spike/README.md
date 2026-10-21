# Karten-Spike (S2)

Testseite: OpenFreeMap-Basiskarte (Vektor) in MapLibre GL JS plus eigenes Gewässer-Overlay aus `tools/water-pipeline` (PMTiles). Gewässer lassen sich antippen.

## Lokal starten
```bash
pnpm install
DATA_DIR=<ausgabeordner der water-pipeline> pnpm serve     # http://localhost:8130
```
URL-Parameter: `?style=liberty|positron|dark`, `&water=0` (Overlay aus), `&lat=…&lng=…&z=…`.

## Automatische Messung (headless Chromium)
```bash
DATA_DIR=… OUT_DIR=… PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs \
  [STYLES=liberty] [VIEWS=koeln] [WATER=1] node measure.mjs
```
Simuliert ein Smartphone (390 × 844, DPR 3, Touch) mit 4-facher CPU-Drosselung. **Headless läuft WebGL in Software** (SwiftShader). Die gemessenen Bildraten sind deshalb eine Untergrenze und ersetzen keinen Test auf echten Geräten.

## Checkliste für echte Geräte (bitte du)
Voraussetzung: Die Testseite ist über HTTPS erreichbar (z. B. Vorschau-Deployment in M1, oder lokal per Tunnel).

| # | Prüfung | iPhone Safari | Android Chrome | Desktop |
|---|---|---|---|---|
| 1 | Karte lädt bei Deutschland-Ansicht in < 3 s (WLAN) | ☐ | ☐ | ☐ |
| 2 | Verschieben und Zoomen mit zwei Fingern flüssig, kein Ruckeln | ☐ | ☐ | – |
| 3 | Kartenbeschriftung gut lesbar (Stil `liberty`, `positron`, `dark`) | ☐ | ☐ | ☐ |
| 4 | Welcher Stil gefällt dir für hell? Welcher für dunkel? | | | |
| 5 | Gewässer antippen → Name und Typ erscheinen oben | ☐ | ☐ | ☐ |
| 6 | Kleiner Teich bei Zoom 15: Antippen trifft ihn zuverlässig | ☐ | ☐ | – |
| 7 | Attribution unten rechts sichtbar und nicht verdeckt | ☐ | ☐ | ☐ |
| 8 | Mobilfunk (4G): Ladezeit Köln-Ansicht subjektiv ok? | ☐ | ☐ | – |
| 9 | Gerät wird bei 2 min Verschieben nicht auffällig warm | ☐ | ☐ | – |
