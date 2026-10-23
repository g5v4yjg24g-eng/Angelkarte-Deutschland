# Video V1 mit HyperFrames

„Fang eintragen, bevor er zurück im Wasser ist“ – 18,8 s, 1080 × 1920, 30 fps, mit Wassergeräusch aus dem Fisch-Clip.
Ergebnis: `../v1-fang-eintragen-1080x1920.mp4`.

| Zeit | Szene |
|---|---|
| 0–3,4 s | Fisch in der Hand, Hook „Fang eintragen, bevor er zurück im Wasser ist.“ |
| 3,2–13,5 s | Echte App-Aufnahme (Beispieldaten) im Handy, Schritte 1–4 oben eingeblendet; Hintergrund: abgedunkelter Fisch-Clip |
| 13,3–16,4 s | Fisch wird freigelassen, „Und der Fisch ist wieder drin.“ |
| 16,2–18,8 s | Schluss-Karte: Fisch-Logo, „Link in der Bio“, „Kostenlos · ohne Konto“ |

## Dateien
- `index.html` – Komposition (HTML + GSAP), Texte und Zeiten dort ändern.
- `assets/app-aufnahme.mp4`, `assets/marks.json` – erzeugt mit `node marketing/tools/record-app.mjs` (Live-App, Beispieldaten, Uhrzeit im Formular auf 07:42 gesetzt). Ändern sich die Zeiten in `marks.json`, die `data-start`-Werte der Schritte in `index.html` anpassen (App-Video beginnt bei 3,4 s).
- `assets/fisch-freilassen.mp4` – **nicht im Repository** (fremdes Material, vom Nutzer hochgeladen am 2026-10-23; Dateiname `20594663-hd_1920_1080_24fps.mp4` deutet auf Pexels hin). **[O]** Quelle und Lizenz bestätigen, bevor das Video veröffentlicht wird. Zum Neurendern die Datei wieder unter diesem Namen ablegen.
- `assets/fonts/` – Inter und Fraunces (SIL OFL 1.1), `assets/fisch.svg` aus dem Marken-Master.

## Rendern
HyperFrames (Apache-2.0) wird nicht als Projektabhängigkeit installiert, sondern per `npx`. Telemetrie vorher ausschalten.
```bash
cd marketing/videos/v1-hyperframes
npx --yes hyperframes@0.8.189 telemetry disable
# in der Cloud-Umgebung den vorinstallierten Headless-Chromium verwenden:
export PRODUCER_HEADLESS_SHELL_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
npx --yes hyperframes@0.8.189 lint .
npx --yes hyperframes@0.8.189 snapshot --at 1.5,7.2,14.8,17.8   # Standbilder zur Kontrolle
npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../v1-fang-eintragen-1080x1920.mp4
```
Lint meldet 6 Hinweise (Empfehlung, Szenen in Unterkompositionen aufzuteilen), keine Fehler.
