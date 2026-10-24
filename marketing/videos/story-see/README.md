# Instagram-Story „See → Fangpunkt“

13 s, 1080 × 1920, 30 fps, ohne Ton. Ergebnis: `../story-see-fangpunkt-1080x1920.mp4`.

| Zeit | Szene |
|---|---|
| 0–6,3 s | See (eigene Aufnahme des Nutzers vom 2026-10-24), leichter Zoom |
| 6,3–8,2 s | Fisch-Logo taucht klein am Horizont auf und kommt näher, Bild dunkelt ab, Schwanzschlag |
| 8,2–13 s | „Fangpunkt“, „Gewässer finden. Fänge festhalten.“, „Kostenlos ausprobieren“, „Link antippen ↓“ |

**In Instagram:** unter „Link antippen ↓“ (etwa im unteren Drittel) einen **Link-Sticker** mit der App-Adresse setzen; Musik aus der Instagram-Bibliothek wählen.

## Neu erzeugen
```bash
# 1. Aufnahme vorbereiten (HDR → SDR, Blöcke glätten, 9:16, 30 fps, vorwärts+rückwärts)
bash marketing/tools/story-see-prep.sh <Originaldatei.mov>
# 2. Rendern (HyperFrames per npx, Telemetrie aus; in der Cloud den vorinstallierten Headless-Chromium nutzen)
cd marketing/videos/story-see
export PRODUCER_HEADLESS_SHELL_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../story-see-fangpunkt-1080x1920.mp4
```
Hinweis: Die Originaldatei war stark komprimiert (ca. 4,6 Mbit/s, sichtbare Blöcke im Himmel). Für spätere Aufnahmen: in der Kamera „Kompatibel“/H.264 oder 1080p ohne HDR filmen und möglichst unkomprimiert schicken.
