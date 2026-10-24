# Visuelles Designsystem für Social Media

Abgeleitet aus der App (Design-Tokens „Tiefwasser“ in `app/src/design/tokens.css`, Marken-Master `app/src/design/brand/fish.json`, Intro in `app/index.html`). Keine eigene Parallelmarke.

## Der Fisch
- **Quelle:** ausschließlich `app/src/design/brand/fish.json` (über `app/scripts/brand.mjs`). Alle Grafiken hier werden daraus erzeugt – Geometrie unverändert, nur Farben für helle Hintergründe getauscht.
- **Bestandteile:** Körper, Schwanz, Rücken- und Bauchflosse, Kiemenbogen, oranges Auge, türkise Welle.
- **Dateien:** `fisch-freigestellt-hell.svg/-1600.png` (für dunkle Flächen), `fisch-freigestellt-dunkel.svg/-1600.png` (für helle Flächen), Profilbilder in `../profile/`.

**Regeln**
1. Fisch schaut immer nach **rechts** (nach vorn), nie spiegeln oder drehen.
2. Proportionen nie verzerren, keine Konturen, Schatten, Verläufe oder 3D-Effekte auf dem Fisch.
3. Das Auge bleibt **orange `#F2994A`** – es ist der Wiedererkennungspunkt.
4. Schutzraum rundum mindestens die Höhe der Rückenflosse.
5. Mindestgröße 32 px (Profil), in Motiven nicht unter 60 px.
6. Auf Fotos nur auf ruhigen, dunklen Flächen oder auf einer Tiefwasser-Fläche.
7. Welle darf in kleinen Anwendungen (Wortmarke in Motiven) entfallen, im Profilbild bleibt sie.

## Farben
| Rolle | Wert | Verwendung |
|---|---|---|
| Tiefwasser (Primärgrund) | `#0B2A33` | Hintergründe, Profilbild |
| Tiefwasser hell (Verlauf) | `#145A6A` / `#11414E` | Lichtschein oben rechts |
| Fisch / Text auf dunkel | `#E8F4F5` | Fisch, Überschriften |
| Akzent Orange | `#F2994A` | Auge, hervorgehobene Wörter, Buttons, Nummern |
| Welle Türkis | `#5CC4D6` | Wellenlinien, Kicker, Rahmen |
| Primär Petrol | `#0F5C6E` | Kicker auf hell, Welle auf hell |
| Hellgrund | `#F3F6F6` | helle Variante |
| Text dunkel | `#0E2229` | Text auf hell |
| Text gedämpft | `#BFD8DC` (dunkel) / `#4A5F66` (hell) | Unterzeilen |
Kontraste stammen aus der App, dort WCAG-AA-geprüft. Orange nur für **ein** hervorgehobenes Wort pro Überschrift.

## Typografie
- **Überschriften:** Fraunces, Gewicht 650, Laufweite −1 %, Zeilenhöhe 1,04. Feed 100 px, Story 106 px (bei 1080 px Breite).
- **Text:** Inter 400/500, Feed 36–37 px, Story 40 px, Zeilenhöhe 1,35–1,4.
- **Kicker:** Inter 700, 26 px, Versalien, Laufweite +14 %, Türkis.
- **Buttons/Pillen:** Inter 600–700, 27–34 px.
- Maximal 3 Textebenen pro Motiv: Kicker, Überschrift, eine Unterzeile.
- Lizenz: SIL OFL 1.1, Dateien und Lizenztexte in `fonts/`.

## Bildsprache
- **Echt vor schön:** eigene Aufnahmen vom Wasser, Hände an Rute und Handy, nasse Fische kurz gezeigt, graues Novemberlicht ist in Ordnung.
- **Keine** Stock-Hochglanzbilder mit Trophäen-Posen, keine fremden Logos, keine Echolot-/Tiefenkarten-Optik (gibt es in der App nicht).
- **App-Screenshots:** nur echte Screenshots der Live-App; ohne Vermerk-Plakette (Entscheidung Nutzer 2026-10-24); Beispieldaten nie als eigene echte Fänge oder Statistik ausgeben. Oberfläche nicht nachbearbeiten.
- **Grafische Natur:** Wellenlinien aus der Welle des Logos (gleiche Strichform, runde Enden) statt Fotos, wenn kein eigenes Bild da ist.

## Komposition und Layouts
- **Raster:** Rand 80 px (Feed) bzw. 84 px seitlich und 230 px oben / 300 px unten (Story, wegen Bedienelementen).
- **Layout A „Telefon“:** Marke oben links → Kicker → Überschrift → Unterzeile; darunter ein oder zwei Handy-Rahmen, unten angeschnitten. Für Funktionen.
- **Layout B „Liste“:** Marke → Kicker → Überschrift → 3–5 nummerierte Punkte (orange Kreise) → Pillen unten. Für Übersichten, Anleitungen, Neuigkeiten.
- **Layout C „Frage“:** Marke → Kicker → große Frage → zwei Antwortkarten A/B. Für Community.
- Wasserzeichen-Fisch unten rechts (9 % Deckkraft) nur in Text-Layouts.
- Feed: wichtige Inhalte innerhalb der mittleren 1080 × 1350, damit der 4:5-Zuschnitt im Feed und der 3:4-Zuschnitt im Raster passen.

## Icons
- Wie in der App: Linien-Icons, 2 px bei 24 px, runde Enden; Nummern-/Häkchen-Kreise in Orange mit dunkler Ziffer `#2B1600`.
- Keine Emojis in Grafiken.

## Überschriften – Stil
- Kurz, Alltagssprache, oft zweiteilig: „Gewässer finden. Fänge festhalten.“ – „Tiefenkarten? Noch nicht.“
- Ein Wort in Orange als Betonung.
- Keine Superlative („beste“, „revolutionär“), keine Versprechen („mehr Fische garantiert“).

## Vorlagen bearbeiten
Alle Motive sind HTML-Vorlagen in `../templates/` und werden mit `node marketing/tools/render.mjs` neu erzeugt. Texte stehen gesammelt in `MOTIFS` in `marketing/tools/render.mjs`. Für Einzelstücke kann man die HTML-Datei in Chrome öffnen, Text ändern und mit den Entwicklerwerkzeugen („Screenshot in Originalgröße“) speichern.
