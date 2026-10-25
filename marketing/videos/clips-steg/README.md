# Steg-Clips (Aufnahmen des Nutzers vom 24.10.2026)

Quelle: zwei iPhone-Aufnahmen (4K, HDR/HLG, 60 fps, Hochformat; Dropbox `/Mobilgeräte-Uploads/Fangpunkt/Rohdatei`,
4:27 und 9:04 min). Feste Kamera auf dem Steg: Ankommen, Aufbauen, viele Würfe und Einkurbeln, am Ende Hinsetzen.
Kein Fisch im Bild – deshalb zeigen die Clips Sessions, Angelstellen, Pausen und ehrliche Statistik, keine Fänge.

| Datei (`../clips-steg-…-1080x1920.mp4`) | Länge | Ausschnitt | Text | App-Funktion |
|---|---|---|---|---|
| `01-ankommen` | 9,6 s | 1153 · 24,5–31,5 s | „Ankommen. Session starten.“ – „Fangpunkt zählt deine echte Angelzeit.“ | Sessions |
| `02-wurf` | 13,8 s | 1159 · 426,8–432,4 s, Zeitlupe 0,5×, Zoom 1,6× | „Gute Stelle?“ – „Mit einem Tipp auf die Karte merken.“ | Angelstellen |
| `03-pause` | 13,6 s | 1159 · 440,5–451,5 s | „Kurz hinsetzen.“ – „Pause drücken – zählt nicht als Angelzeit.“ | Session-Pausen |
| `04-schneidertag` | 9,6 s | 1159 · 0–420 s als Zeitraffer (60×) | „Kein Biss? Gehört dazu.“ – „Fänge pro Angelstunde – auch Schneidertage zählen.“ | Statistik |
| `05-feierabend` | 9,6 s | 1153 · 252,5–259,5 s | „Feierabend.“ – „Alles gespeichert – nur auf deinem Handy.“ | Session beenden, lokale Daten |
| `06-sonntag-intro` | 5 s | 1159 · 488–493 s | „Beißfenster-Check – Angelwetter der Woche“ | Intro für das Sonntagsformat (ohne Schluss-Karte) |

Clips 01–05 enden mit der Schluss-Karte (Fisch-Logo, „Link in der Bio“). Ton: Umgebungston bei 01, 03, 05 (leise, ein- und
ausgeblendet), 02/04/06 stumm – Musik in der Plattform-App dazulegen.

## Neu erzeugen
```bash
bash marketing/tools/clips-steg-prep.sh <Ordner mit video-1153.mov und video-1159.mov>   # Ausschnitte (≈ 20 min)
node marketing/tools/clips-steg-build.mjs                                                 # Szenen aus der Liste CLIPS
bash marketing/tools/clips-steg-render.sh [Szene …]                                       # Rendern mit HyperFrames
```
Texte und Zeiten stehen in `CLIPS` in `marketing/tools/clips-steg-build.mjs`. Die Rohaufnahmen und Ausschnitte liegen nicht im Repository.
