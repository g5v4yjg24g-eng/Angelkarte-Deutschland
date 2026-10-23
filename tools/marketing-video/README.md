# Fangpunkt – Werbevideo

Werbeclip (42 s) für Fangpunkt, programmatisch mit [Remotion](https://www.remotion.dev) gebaut. Getrennt von der App: Hier wird nichts aus `app/` verändert, nur gelesen (Marken-Master `app/src/design/brand/fish.json`).

**Stand:** Vollständige Fassung (Phase 4). Echte App-Ansichten, Logo, Sprecher (ElevenLabs), eigene Musik, drei Angelszenen (Pexels) und QR-Abschluss. Die Clips liegen nicht im Repository (Größe, fremde Lizenz) – Liste und Herkunft in `assets/fishing-scenes/README.md`.

**Ziel-URL des QR-Codes:** `https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/` (GitHub Pages, Freigabe Nutzer 2026-10-23). Änderung nur in `video.config.json` → danach `pnpm qr` und neu rendern.

## Ausgaben

| Datei | Inhalt |
|---|---|
| `output/fangpunkt-werbevideo-1080x1920.mp4` | Mastervideo vertikal (Reels, TikTok, Shorts) |
| `output/fangpunkt-werbevideo-1920x1080.mp4` | Horizontale Fassung mit eigenem Layout (Text links, Handy rechts) |
| `assets/qr/fangpunkt-qr.svg` | QR-Code als Vektor für Flyer und Plakate |
| `assets/qr/fangpunkt-qr.png` | QR-Code 4096 × 4096 px |

Videos liegen nicht im Repository (`output/` ist ignoriert); sie werden als Anhang eines Releases geteilt oder lokal neu gerendert.

## Ablauf (Storyboard)

| Zeit | Szene | Bild | Sprecher |
|---|---|---|---|
| 0–4,5 s | Leidenschaft | Angelszene „See im Morgennebel“, langsame Kamerafahrt | „Dein nächster Fang beginnt mit dem richtigen Überblick.“ |
| 4,5–11 s | App entdecken | Handy wird eingeblendet und steht danach still; echte Aufnahme (30 fps): Suche „Hohendeicher“ → Karte fliegt zum See | „Mit Fangpunkt entdeckst du Gewässer in ganz Deutschland.“ |
| 11–23,5 s | Funktionen | 4 echte Ansichten: Spots & Stege · Fang erfassen · Wetter & Pegel · Statistik | je ein kurzer Satz pro Funktion |
| 23,5–30 s | Fangmoment | Angler auf dem Steg im Nebel → Forelle wird zurückgesetzt und schwimmt davon (im Hochformat als großes Quadrat vor unscharfem Hintergrund) → echter Fangbuch-Eintrag | „Denn jeder Fang erzählt eine Geschichte.“ |
| 30–42 s | Abschluss | Logo-Animation wie im App-Intro, Name, Slogan; **QR-Code ab 33 s unbewegt bis zum Ende (9 s)** | „Fangpunkt. Jetzt scannen und kostenlos entdecken.“ |

Tiefenkarten kommen bewusst nicht vor: Sie sind in der App nicht umgesetzt (PLAN.md M9).

## Einrichtung

Voraussetzungen: Node ≥ 22 mit pnpm, FFmpeg, Python 3 mit NumPy, Chromium (Playwright; in der Cloud-Umgebung vorinstalliert).

```bash
pnpm install                                   # im Repo-Root (Workspace)
pip install faster-whisper                     # Schnitt und Verständlichkeitsprüfung des Sprechers
# nur für die lokale Ersatzstimme (voice.engine = "piper"):
pip install piper-tts
mkdir -p ~/.piper && cd ~/.piper
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high
curl -LO $B/de_DE-thorsten-high.onnx && curl -LO $B/de_DE-thorsten-high.onnx.json
```

Lokal ohne vorinstalliertes Chromium lädt Remotion beim ersten Rendern selbst einen Browser (`remotion.config.ts`).

## Befehle (in `tools/marketing-video/`)

```bash
pnpm qr                 # QR-Code aus video.config.json erzeugen und durch Dekodieren prüfen
pnpm screenshots        # echte App-Ansichten der veröffentlichten App aufnehmen (≈ 6 min)
pnpm screenshots --only=stats,weather   # nur einzelne Ansichten neu aufnehmen
pnpm music              # eigene Musik, Naturgeräusche, Effekte erzeugen (deterministisch)
python3 scripts/split-voiceover.py assets/voiceover/elevenlabs/hans-deep-warm-german_eleven-v4.mp3
                        # ElevenLabs-Aufnahme satzweise schneiden (Wort-Zeitstempel der Spracherkennung)
pnpm voiceover          # nur bei voice.engine = "piper": lokale Ersatzstimme erzeugen
pnpm studio             # Vorschau im Browser mit Zeitleiste
pnpm render:vertical    # → output/fangpunkt-werbevideo-1080x1920.mp4
pnpm render:horizontal  # → output/fangpunkt-werbevideo-1920x1080.mp4
pnpm check output/fangpunkt-werbevideo-1080x1920.mp4            # technische Prüfung
pnpm check output/fangpunkt-werbevideo-1920x1080.mp4 1920 1080
python3 scripts/asr-check.py   # Sprecher per Spracherkennung gegen den Text prüfen
```

Komplett neu: `pnpm qr && pnpm screenshots && pnpm music && python3 scripts/split-voiceover.py <aufnahme> && pnpm render:vertical && pnpm render:horizontal`.

Die Kartenfahrt (`flight`) wird Bild für Bild aufgenommen: Die Uhr der Seite steht während der Aufnahme still und wird pro Videobild um 1/30 s weitergestellt. Dadurch läuft sie im Video flüssig, auch wenn der Rechner die Karte nur langsam zeichnet (Cloud-Umgebung ohne Grafikkarte).

## Was wo geändert wird

- **Texte, Slogan, Handlungsaufforderung, URL, Sprechertext und -zeitpunkte:** `video.config.json`. Wird der Sprechertext geändert, braucht es eine neue Aufnahme: in ElevenLabs (Stimme und Modell unter `voice.elevenlabs`) den ganzen Text als eine Aufnahme erzeugen, nach `assets/voiceover/elevenlabs/` legen, `voice.source` anpassen und `split-voiceover.py` laufen lassen. Das Skript bricht ab, wenn die Wortzahl der Aufnahme nicht zum Text passt. `voiceover[].say` gilt nur für die Piper-Ersatzstimme (Ausspracheschreibung, z. B. „Spotts“).
- **Szenenlängen:** `T` in `src/config.ts` (QR-Stillstand `qrStill`; `scripts/check.mjs` prüft ab derselben Sekunde).
- **Angelszenen:** Clip nach `assets/fishing-scenes/` legen und den Dateinamen unter `clips` in `video.config.json` eintragen (`null` = Platzhalter).
- **App-Ansichten:** `pnpm screenshots` nimmt sie neu auf; welche Datei in welcher Szene erscheint, steht unter `screens`. Aufnahme-Schritte in `scripts/screenshots.mjs`.
- **Musik/Geräusche:** `scripts/music.py` anpassen oder eigene Datei als `assets/music/music.wav` ablegen (dann Lizenz unten eintragen). Lautstärken in `Sound()` in `src/Video.tsx`.
- **Layout der Formate:** `LAYOUTS` in `src/Video.tsx`.

## HyperFrames-Fassung (Hochformat, überarbeitet)

Im Ordner `hyperframes/` liegt eine überarbeitete Hochformat-Fassung, gebaut mit [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP, Open Source von HeyGen, lokal gerendert, keine Kosten). Sie nutzt dieselben Medien (`hyperframes/assets` verweist auf `assets/`). Was sich gegenüber der Remotion-Fassung geändert hat, steht in `hyperframes/TRANSLATION_NOTES.md`.

```bash
cd tools/marketing-video/hyperframes
npx --yes hyperframes@0.8.188 browser ensure          # einmalig: Chrome zum Rendern
npx --yes hyperframes@0.8.188 check                   # Prüfung (Lint, Laufzeit, Layout, Kontrast)
npx --yes hyperframes@0.8.188 preview --background    # Vorschau im Browser (HyperFrames Studio)
npx --yes hyperframes@0.8.188 render --quality delivery --output ../output/raw-hf-vertical.mp4
cd .. && node scripts/finalize.mjs output/raw-hf-vertical.mp4 output/fangpunkt-werbevideo-hyperframes-1080x1920.mp4
pnpm check output/fangpunkt-werbevideo-hyperframes-1080x1920.mp4
```

Texte stehen direkt in `hyperframes/compositions/*.html`; Farben sind Variablen in `hyperframes/index.html`. Der Farblook der Angelclips ist als `data-color-grading` an den `<video>`-Elementen gespeichert (ändern mit `npx hyperframes media-treatment`). Die anonyme Nutzungsstatistik der HyperFrames-CLI ist abgeschaltet (`hyperframes telemetry disable`).

## Erklärvideo „Ein Angeltag mit Fangpunkt“ (HyperFrames, Hochformat, ca. 68 s)

Zeigt in sieben Schritten, wie man die App an einem Angeltag benutzt (Plan: `hyperframes-tutorial/SPEC.md`, Storyline A aus `STORYLINES.md`): Wetter & Pegel → Gewässer finden → Steg markieren → Session starten → Fang erfassen (mit Landesrecht-Hinweis, „Keine Rechtsauskunft“) → Fangbuch → Statistik → QR-Abschluss.

```bash
cd tools/marketing-video
node scripts/record-tutorial.mjs                     # echte Abläufe in der veröffentlichten App aufnehmen → assets/tutorial/
                                                     #   (--only=weather,catch … einzelne; --dry = Probelauf in Echtzeit mit Bild)
python3 scripts/split-voiceover.py assets/voiceover/elevenlabs/<erklaervideo>.mp3 \
  --config=hyperframes-tutorial/voiceover.config.json --out=assets/voiceover/tutorial
cd hyperframes-tutorial && node build.mjs             # Zeiten aus Sprecher + Aufnahmen → index.html, compositions/, timing.txt
python3 ../scripts/music.py --dur=<Gesamt aus timing.txt> --suffix=-tutorial
npx --yes hyperframes@0.8.188 check
npx --yes hyperframes@0.8.188 render --quality delivery --output ../output/raw-tutorial.mp4
cd .. && node scripts/finalize.mjs output/raw-tutorial.mp4 output/fangpunkt-erklaervideo-1080x1920.mp4
node scripts/check.mjs output/fangpunkt-erklaervideo-1080x1920.mp4 1080 1920 --qr-from=<„QR unbewegt ab“ aus timing.txt> --min=55 --max=80
```

- **Aufnahmen:** `scripts/record-tutorial.mjs` spielt die Beispieldaten ein und bedient die App wie ein Nutzer (Handy-Ansicht 393 × 798 CSS-px, doppelte Pixeldichte). Die Seitenuhr steht während der Aufnahme still und wird je Bild um 1/30 s weitergestellt, damit Kartenflüge flüssig sind. Jeder Tipp landet mit Zeit und Ort in `<name>.taps.json`; daraus zeichnet das Video den Fingerring genau an diese Stelle.
- **Sprecher:** ElevenLabs „Hans – Deep Warm German“ (eleven_v4), Text in `hyperframes-tutorial/voiceover.config.json` (Flow https://elevenlabs.io/app/flows/YUFSdtKmvl5lYnRb12LB). Ohne geschnittene Aufnahme schätzt `build.mjs` die Satzlängen und lässt den Sprecher weg (nur zum Ansehen).
- **Nicht von Hand ändern:** `index.html` und `compositions/` werden aus `src/` erzeugt. Texte, Überschriften und Fußnoten stehen in `src/*.html` bzw. `build.mjs` (`plan`, `notes`).
- **Ergebnis (2026-10-23):** `output/fangpunkt-erklaervideo-1080x1920.mp4`, 65,2 s; `check.mjs` bestanden (−14,5 LUFS, Spitze −1,3 dBFS, QR ab 59,65 s unbewegt und aus drei Bildern dekodiert). Spracherkennung (faster-whisper small) findet alle 13 Sätze. Der Schnitt gleicht Text und erkannte Wörter an, weil die Erkennung z. B. „Schonzeit“ als „schon Zeit“ hört.
- Die Fußnote unter dem Handy nennt je Bildschirm „Beispieldaten“ und die Quellen (Karte, Open-Meteo, PEGELONLINE); bei Fang und Fangbuch zusätzlich „Keine Rechtsauskunft“.

## Funktionsanimation „Session-Rückblick mit GPS-Route“ (HyperFrames, 1920 × 1080, ca. 34 s)

Kein Werbevideo: eine schematische Animation, wie die Route einer Session entsteht und was der Rückblick zeigt (Plan: `hyperframes-route/SPEC.md`, Funktion aus PR #69). Der Angler läuft in Schlangenlinien am Ufer; die GPS-Punkte kommen aus einer Simulation mit denselben Regeln wie `app/src/domain/track.ts`: höchstens alle 10 s, erst ab 8 m Bewegung, ungenaue Fixe (> 50 m) und Sprünge (> 15 m/s) werden verworfen, nach „App im Hintergrund“ beginnt ein neuer Abschnitt und die Lücke bleibt offen. Rauschen mit festem Startwert, deshalb ist jeder Lauf gleich. Dauer, Strecke und Einträge im Rückblick stammen aus dieser Simulation und sind als Beispielwerte gekennzeichnet.

```bash
cd tools/marketing-video/hyperframes-route
node build.mjs                                        # → index.html, compositions/route.html, timing.txt
python3 ../scripts/music.py --dur=<Gesamt aus timing.txt> --suffix=-route
npx --yes hyperframes@0.8.188 check
npx --yes hyperframes@0.8.188 render --quality delivery --output ../output/raw-route.mp4
cd .. && node scripts/finalize.mjs output/raw-route.mp4 output/fangpunkt-session-rueckblick-1920x1080.mp4
```

## Echte App, Beispieldaten

Alle Bildschirme sind Aufnahmen der veröffentlichten App (Handy-Ansicht 393 × 798 CSS-px bei 3-facher Pixeldichte, deutsche Spracheinstellung). Es werden ausschließlich Handy-Ansichten gezeigt. Fangbuch, Sessions, Orte und Statistik zeigen **Beispieldaten** (`scripts/demo-data.mjs`, eingespielt über den normalen Import der App) am Hohendeicher See (OSM-Relation 9075175); das Video kennzeichnet sie mit „Beispieldaten“. Wetter, Warnungen und Gewässerprofil sind echte Antworten der App zum Aufnahmezeitpunkt (Wetter vom 23.10.2026).

## Prüfungen

`pnpm check` prüft Abmessungen, Dauer, Codec (H.264, yuv420p), Tonspur, Lesbarkeit bis zum Ende, Lautheit (−14 LUFS, Spitze ≤ −1 dBFS), dekodiert den QR-Code aus drei Einzelbildern des fertigen Videos (33,05 s, Mitte, Ende) und vergleicht ihn mit der Ziel-URL. Außerdem prüft es, dass der QR-Abschluss unbewegt bleibt.

Nicht automatisch geprüft: ein Scan mit einem echten Smartphone vom Bildschirm. Das bitte selbst einmal testen.

## Lizenzen und Quellen

| Bestandteil | Quelle / Lizenz |
|---|---|
| HyperFrames 0.8.188 | Open Source (HeyGen), lokal gerendert; Lichteinfall-Block `organic-light-leak-overlay` aus der HyperFrames-Bibliothek |
| Remotion 4 | Free License für Einzelpersonen, gemeinnützige Organisationen und Firmen bis 3 Beschäftigte (`node_modules/remotion/LICENSE.md`, gelesen 2026-10-23) |
| Schriften Inter, Fraunces | SIL Open Font License 1.1 (wie in der App) |
| Karte in den App-Ansichten | OpenFreeMap © OpenMapTiles, Daten © OpenStreetMap-Mitwirkende (ODbL 1.0). Vermerk ist im Video eingeblendet. |
| Musik, Naturgeräusche, Effekte | eigene, per Code erzeugte Werke (`scripts/music.py`), keine fremden Rechte |
| Sprecher | ElevenLabs, Stimme „Hans – Deep Warm German“ (Bibliotheksstimme, ID `43H9TfBpRZiNdzjX9Acg`), Modell `eleven_v4`, erzeugt vom Nutzer am 2026-10-23 im eigenen ElevenLabs-Konto. **Offen [O]:** Nutzungsrechte hängen vom ElevenLabs-Tarif des Kontos ab (laut ElevenLabs-Bedingungen im kostenlosen Tarif keine kommerzielle Nutzung und Namensnennung „ElevenLabs“ nötig [A], nicht in dieser Sitzung geprüft). Bei Bedarf Vermerk in den Beitragstext. |
| Ersatzstimme (nicht im Video) | Piper (GPL-3.0, Werkzeug) mit `de_DE-thorsten-high`: Datensatz CC0, Basismodell lessac mit nichtkommerziellen Trainingsdaten [O] |
| QR-Code | `qrcode` (MIT), Prüfung mit `jsqr` (Apache-2.0) |
| Angelszenen | siehe `assets/fishing-scenes/README.md` |
