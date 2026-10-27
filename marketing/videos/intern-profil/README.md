# Internes Erklärvideo „Profil“

Nur fürs Team (nicht für Social Media). Querformat 1920 × 1080, 47 s, ohne Ton. Ergebnis: `../intern-profil-1920x1080.mp4`.
Aufbau wie `../intern-knoten`.

Inhalt: Titel → 1 Profil in der Leiste → 2 Neuer Beitrag aus einem Fang (verknüpfen, Text, Sichtbarkeit, Posten) →
3 Gefällt mir, Kommentar, Link zum Fang → 4 Teilen/Freunde „demnächst“ → 5 Profil bearbeiten → Stand und offene Punkte
(nach CLAUDE.md, Profilseite 2026-10-27) mit Bildnachweis.

## Beispieldaten
Echte Live-App mit **Beispieldaten**: Profil „Jonas“ (ausgedacht), 8 Beiträge, ein Hecht-Fang (26.10.2026), aus dem in der
Aufnahme der 9. Beitrag gepostet wird. Name, Texte und Fangdaten sind ausgedacht.

Fotos: **eigene Aufnahmen des Nutzers** (Wunsch Nutzer 2026-10-27): Seebild als Profilbild, drei Hechte, fünf Barsche und ein
Ast am Köder. Für die Aufnahme ohne Metadaten neu gespeichert (die Originale enthielten EXIF-Daten), auf 1280 px verkleinert,
Vorschaubilder quadratisch. Sie liegen nur lokal in `assets/eigene-fotos/` (nicht im Repository); im fertigen Video sind sie zu sehen.
Zum Neu-Erzeugen die Fotos dort ablegen: `see.jpg`, `hecht-hand.jpg`, `hecht-gras.jpg`, `hecht-drill.jpg`, `barsch-1.jpg` … `barsch-5.jpg`,
`haenger.jpg`, jeweils mit `-thumb.jpg` (400 × 400).

## Neu erzeugen
```bash
node marketing/tools/record-profil.mjs        # App-Aufnahme assets/app-profil.mp4 (+ app-profil.json mit Zeitpunkten)
ffmpeg -y -i marketing/videos/intern-profil/assets/app-profil.mp4 -frames:v 1 marketing/videos/intern-profil/assets/app-profil-start.png
cd marketing/videos/intern-profil && npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../intern-profil-1920x1080.mp4
```
In der Cloud-Umgebung vorher `PRODUCER_HEADLESS_SHELL_PATH` setzen (siehe `tools/clips-steg-render.sh`). Ändert sich die
Aufnahme, die Zeiten in `index.html` an `app-profil.json` anpassen (Versatz 3,5 s).
