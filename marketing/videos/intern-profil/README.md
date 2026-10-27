# Internes Erklärvideo „Profil“

Nur fürs Team (nicht für Social Media). Querformat 1920 × 1080, 47 s, ohne Ton. Ergebnis: `../intern-profil-1920x1080.mp4`.
Aufbau wie `../intern-knoten`.

Inhalt: Titel → 1 Profil in der Leiste → 2 Neuer Beitrag aus einem Fang (verknüpfen, Text, Sichtbarkeit, Posten) →
3 Gefällt mir, Kommentar, Link zum Fang → 4 Teilen/Freunde „demnächst“ → 5 Profil bearbeiten → Stand und offene Punkte
(nach CLAUDE.md, Profilseite 2026-10-27) mit Bildnachweis.

## Beispieldaten
Echte Live-App mit **Beispieldaten**: Profil „Jonas“ (ausgedacht), 8 Beiträge, ein Zander-Fang (68 cm, 26.10.2026), aus dem in
der Aufnahme der 9. Beitrag gepostet wird. Texte und Fangangaben sind ausgedacht. Die Fotos zeigen fremde Personen und
Fänge und dürfen nie als eigene Fänge ausgegeben werden. Fischarten nach Dateititel und Augenschein (Maräne: Cisco, Gattung *Coregonus*).

Fotos von Wikimedia Commons, auf 1280 px verkleinert, Vorschaubilder quadratisch, Profilbild zugeschnitten
(Bearbeitungen unter derselben Lizenz wie das Original). Abgerufen 27.10.2026, Rohdaten in `assets/beispielbilder/quellen.json`.

| Datei | Verwendung | Urheber | Lizenz | Quelle |
|---|---|---|---|---|
| `avatar.jpg` | Profilbild | USFWS Mountain Prairie | Public domain | [Shorthead Redhorse Sucker (51301754769).jpg](https://commons.wikimedia.org/wiki/File:Shorthead_Redhorse_Sucker_(51301754769).jpg) |
| `zander.jpg` | Zander (live gepostet) | Ruben Da Rocha | CC0 | [Lucioperca2024.jpg](https://commons.wikimedia.org/wiki/File:Lucioperca2024.jpg) |
| `hecht.jpg` | Hecht | Bureau  of Land Management | Public domain | [-BLMcareers (21681393828).jpg](https://commons.wikimedia.org/wiki/File:-BLMcareers_(21681393828).jpg) |
| `karpfen.jpg` | Karpfen | ASSOPECHE | CC BY-SA 4.0 | [Carpe lac D'Enghien les Bains.JPG](https://commons.wikimedia.org/wiki/File:Carpe_lac_D%27Enghien_les_Bains.JPG) |
| `spiegelkarpfen.jpg` | Spiegelkarpfen | Plechinger | CC BY-SA 4.0 | [Josljkdfm.jpg](https://commons.wikimedia.org/wiki/File:Josljkdfm.jpg) |
| `maraene.jpg` | Maräne | unbekannt (NARA) | Public domain | [Logan Canyon Scenic Byway - A Cisco Fish In Hand - NARA - 7720123.jpg](https://commons.wikimedia.org/wiki/File:Logan_Canyon_Scenic_Byway_-_A_Cisco_Fish_In_Hand_-_NARA_-_7720123.jpg) |
| `bachforelle-1.jpg` | Bachforelle 1 | Bill Blevins from Fairport, NY, USA; color-corrected slightly by Daniel Case prior to upload | CC BY 2.0 | [Oatka Creek brown trout.jpg](https://commons.wikimedia.org/wiki/File:Oatka_Creek_brown_trout.jpg) |
| `bachforelle-2.jpg` | Bachforelle 2 | Pitka Bernhard | CC BY-SA 4.0 | [Hungrige Bachforelle.jpg](https://commons.wikimedia.org/wiki/File:Hungrige_Bachforelle.jpg) |
| `regenbogenforelle.jpg` | Regenbogenforelle | Michael Humling/USFWS | Public domain | [Winthrop NFH rainbow trout in hands Methow River.png](https://commons.wikimedia.org/wiki/File:Winthrop_NFH_rainbow_trout_in_hands_Methow_River.png) |
| `forelle-fliege.jpg` | Forelle (Fliegenfischen) | Marcin Szala | CC BY 3.0 | [500px photo (124221329).jpeg](https://commons.wikimedia.org/wiki/File:500px_photo_(124221329).jpeg) |

## Neu erzeugen
```bash
node marketing/tools/record-profil.mjs        # App-Aufnahme assets/app-profil.mp4 (+ app-profil.json mit Zeitpunkten)
ffmpeg -y -i marketing/videos/intern-profil/assets/app-profil.mp4 -frames:v 1 marketing/videos/intern-profil/assets/app-profil-start.png
cd marketing/videos/intern-profil && npx --yes hyperframes@0.8.189 render -q high -f 30 --video-frame-format png -o ../intern-profil-1920x1080.mp4
```
In der Cloud-Umgebung vorher `PRODUCER_HEADLESS_SHELL_PATH` setzen (siehe `tools/clips-steg-render.sh`). Ändert sich die
Aufnahme, die Zeiten in `index.html` an `app-profil.json` anpassen (Versatz 3,5 s).
