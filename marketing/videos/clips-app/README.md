# Clip trifft App (Split-Screen)

Oben eine Steg-Aufnahme des Nutzers, unten das Handy mit der **echten App** (Live-Version, Beispieldaten), die genau das
Gleiche tut. Die App-Aufnahme ist echt; nur die Uhr wird für „15 Minuten später“ vorgestellt (im Video als Hinweis eingeblendet).

| Datei (`../clips-app-…-1080x1920.mp4`) | Länge | Aufnahme oben | App unten |
|---|---|---|---|
| `01-pause` | 13,6 s | wie `clips-steg 03-pause` (1159 · 440,5–451,5 s) | laufende Session → „Pause“ → 15 min später → „Weiter angeln“; Angelzeit bleibt 1 h 12 min, Dauer läuft weiter |

## Neu erzeugen
```bash
bash marketing/tools/clips-steg-prep.sh <Rohaufnahmen>   # liefert clips-steg/assets/pause.mp4
cp marketing/videos/clips-steg/assets/pause.mp4 marketing/videos/clips-app/assets/steg-pause.mp4
node marketing/tools/record-pause.mjs                    # App-Aufnahme assets/app-pause.mp4 (+ app-pause.json mit Zeitpunkten)
ffmpeg -y -i marketing/videos/clips-app/assets/app-pause.mp4 -frames:v 1 marketing/videos/clips-app/assets/app-pause-start.png
bash marketing/tools/clips-app-render.sh 01-pause
```
Ändert sich die App-Aufnahme, die Zeiten in `szenen/01-pause.html` an `app-pause.json` anpassen (Versatz 2,4 s).
