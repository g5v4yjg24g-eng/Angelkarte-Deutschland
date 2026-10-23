# Marketing-Paket Fangpunkt

Stand 2026-10-23. Getrennt von der App: Nichts in diesem Ordner wird gebaut oder ausgeliefert.

## Inhalt auf einen Blick

| Was | Wo |
|---|---|
| **Strategie** – Analyse der App, Positionierung, Slogan, Zielgruppen, Konkurrenz, Plattformen, 9 Content-Serien, Link-/QR-Strategie, Community, Budget, Kennzahlen, Recht | [STRATEGIE.md](STRATEGIE.md) |
| **90-Tage-Redaktionsplan** – Rhythmus, Vorbereitung, 44 Beiträge mit Hook, Ablauf, CTA, Material, Zeitbedarf | [content-calendar/](content-calendar/REDAKTIONSPLAN-90-TAGE.md) (Markdown + CSV) |
| **Wochenauswertung** (Tabellenvorlage) | [content-calendar/auswertung-vorlage.csv](content-calendar/auswertung-vorlage.csv) |
| **Captions und Hashtags** zu den 10 Motiven | [posts/CAPTIONS.md](posts/CAPTIONS.md) |
| **5 Video-Konzepte** mit Szenenplan, Sprechertext, Untertiteln | [videos/VIDEO-KONZEPTE.md](videos/VIDEO-KONZEPTE.md) |
| **Designsystem** und Regeln für das Fisch-Logo | [brand/DESIGNSYSTEM.md](brand/DESIGNSYSTEM.md) |
| **Übersicht aller Bilder und Videos** (im Browser öffnen) | [UEBERSICHT.html](UEBERSICHT.html) |
| **Kontaktvorlagen** (Creator, Vereine, Gruppen, Einwilligung) | [templates/KONTAKT-VORLAGEN.md](templates/KONTAKT-VORLAGEN.md) |

## Bilddateien

| Datei | Format | Zweck |
|---|---|---|
| `profile/profilbild-dark-1080.png` | 1080 × 1080 | **Profilbild (empfohlen)** für Instagram, TikTok, YouTube, Facebook |
| `profile/profilbild-light-1080.png` | 1080 × 1080 | Alternative auf hellem Grund |
| `profile/profilbild-*-400.png`, `*.svg` | 400 px / Vektor | kleinere Uploads, Druck |
| `profile/pruefbogen-kleine-groessen.png` | – | Kontrolle: rund zugeschnitten bei 180 bis 32 px |
| `brand/fisch-freigestellt-hell(.svg/-1600.png)` | transparent | Fisch für dunkle Flächen (Videos, Schluss-Karte) |
| `brand/fisch-freigestellt-dunkel(.svg/-1600.png)` | transparent | Fisch für helle Flächen |
| `brand/banner-youtube-2560x1440.png` | 2560 × 1440 | YouTube-Kanalbanner (Inhalt in der sicheren Mitte) |
| `brand/banner-facebook-1640x624.png` | 1640 × 624 | Facebook-Titelbild |
| `posts/NN-…-feed-1080x1440.png` | 3:4 | Instagram-Feed (passt zum 3:4-Profilraster) |
| `posts/NN-…-feed-1080x1350.png` | 4:5 | Instagram/Facebook-Feed (klassisch) |
| `posts/02-karussell/…-k1…k6` | 4:5 | Karussell „Fangpunkt in fünf Bildern“ |
| `stories/NN-…-story-1080x1920.png` | 9:16 | Stories, TikTok-Fotomodus |
| `stories/reel-cover/cover-video-v1…v5-1080x1920.png` | 9:16 | Titelbilder für die fünf Video-Konzepte (Text mittig, übersteht den 3:4- und 4:5-Zuschnitt) |
| `stories/reel-cover/cover-serie-…-1080x1920.png` | 9:16 | Titelbilder für wiederkehrende Serien (Beißfenster-Check, Wissen in 30 Sekunden, Werkstatt-Notiz, Frag die Runde, Euer Feedback) |
| `brand/schlusskarte-1080x1920.png` | 9:16 | Schluss-Karte „Link in der Bio“ für alle Videos |
| `videos/reel-fuenf-bilder-1080x1920.mp4` | 9:16, 17 s | **fertiges Slideshow-Reel** aus dem Karussell, ohne Ton (Musik in der Plattform-App wählen) |
| `screenshots/{light,dark}-*.png` | 1170 × 2532 | echte Screenshots der Live-App mit **Beispieldaten** (hell und dunkel) |

**Die zehn Motive:** 01 Launch · 02 App-Übersicht (+ Karussell) · 03 Tiefenkarten – ehrlich „noch nicht“ · 04 Fangbuch · 05 Wetter & Beißfenster · 06 Statistik · 07 Angelstellen & Heatmap · 08 Hinter den Kulissen · 09 Community-Frage · 10 Ausprobieren.

### Woher die Bilder kommen
- **Fisch:** unverändert aus dem Marken-Master der App (`app/src/design/brand/fish.json`, dieselbe Figur wie in der Ladeanimation). Für helle Hintergründe sind nur die Farben getauscht.
- **Screenshots:** automatisch von der Live-App aufgenommen (`tools/screenshots.mjs`) mit ausgedachten Beispieldaten am Möhnesee. Wetter, Warnungen und Pegel darin sind echte Werte vom 2026-10-23. Jedes Motiv mit Screenshot trägt die Plakette „Echte App · Beispieldaten“. Die Kopfzeile „Genauigkeit ca. 0 m“ auf der Karte kommt vom simulierten Standort im Testbrowser.
- **Gestaltung:** HTML-Vorlagen (`templates/`), mit Chromium in exakter Pixelgröße gerendert. Ein Bildgenerator war nicht verfügbar; Naturbezug entsteht über die Wellenlinien aus dem Logo statt über Fotos. **Es wurden keine KI-Fotos und keine Stockfotos verwendet.**
- **Schriften:** Fraunces und Inter (SIL OFL 1.1), Lizenztexte in `brand/fonts/`.

### Neu erzeugen
```bash
# im Repo-Root, nach pnpm install
node marketing/tools/screenshots.mjs        # Screenshots von der Live-App (ca. 3 min, braucht Internet)
node marketing/tools/render.mjs             # Profilbilder, Banner, Motive, Reel-Cover, Schluss-Karte
bash marketing/tools/reel.sh                # Slideshow-Reel aus dem Karussell (ffmpeg)
python3 marketing/tools/overview.py         # UEBERSICHT.html
python3 marketing/tools/build_calendar.py   # Redaktionsplan (CSV + Markdown)
```
Texte der Motive stehen in `MOTIFS` in `tools/render.mjs`.

## Offen

### Entscheidungen von dir (vor dem ersten Beitrag)
1. **App öffentlich bewerben – ja oder nein?** In PLAN.md steht „App bleibt privat (Nutzer 2026-10-22), daher kein Impressum“. Eine Kampagne ändert das.
2. **Impressum** auf App/Landingpage und in den Profilen (§ 5 DDG prüfen; keine Rechtsauskunft).
3. **Name „Fangpunkt“ bleibt** – DPMAregister ohne Treffer (2026-10-23). Noch kurz prüfen: EUIPO (eSearch plus). `fangpunkt.de` gehört einer fremden Branche → `fangpunkt.app` registrieren.
4. **Stabile Adresse:** eigene Domain (Kosten ca. 10–25 €/Jahr [A]) oder Bestätigung, dass die GitHub-Pages-Adresse bleibt.
5. **Zugriffsmessung** auf der Website ja/nein (Datenschutz-Entscheidung; ohne sie sind nur Plattform-Statistiken messbar).
6. **Feedback-Weg** in der App (z. B. Link „Feedback geben“ unter „Mehr“) – wäre eine kleine App-Änderung in einem eigenen PR.

### Fehlende Informationen
- **QR-Code nicht erstellt** – die endgültige Zieladresse fehlt (siehe STRATEGIE §9). Es braucht: die Domain *oder* deine Bestätigung der jetzigen Adresse, plus die Kampagnen-Unterseite (z. B. `/flyer`).
- Verfügbarkeit der Handles `@fangpunkt` auf Instagram, TikTok, YouTube, Facebook (aus dieser Umgebung nicht prüfbar).
- Ob `fangpunkt.app` registrierbar ist (nur DNS geprüft: kein Eintrag). Danach: QR-Code und Kampagnen-Links.
- Ob du dein Gesicht/deine Stimme zeigen möchtest (beeinflusst Video-Konzepte V2–V4).
- Eigene Fangfotos und echte eigene Statistik für Jahresrückblick (V3) und „Mein Angeljahr“.

### Nicht umgesetzt
- **Videos V1–V5 nicht produziert** – nur Konzepte plus fertige Titelbilder und Schluss-Karte (es fehlen eigene Aufnahmen und Bildschirmvideos vom Handy). Fertig ist nur das Slideshow-Reel aus dem Karussell.
- **Keine KI-generierten Fotos** – kein Bildgenerator verfügbar; die Motive sind grafisch und mit echten Screenshots gebaut.
- **Nichts veröffentlicht**, keine Konten angelegt, keine Dienste gebucht.
- Motiv 08 nennt „Diese Woche neu“ (Stand 2026-10-23) – vor dem Posten aktualisieren.
- Tiefenkarten-Motiv bewirbt bewusst *keine* Tiefenkarten (gibt es nicht).
- Plattformmaße für TikTok/YouTube/Facebook nicht in offiziellen Hilfeseiten geprüft (nur Ratgeber; für Instagram ebenfalls keine offizielle Quelle gefunden).
