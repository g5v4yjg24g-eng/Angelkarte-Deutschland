# Übertragung Remotion → HyperFrames

Quelle: `../src` (Remotion 4, Szenen `FangpunktVideo`), Ziel: dieses Projekt (HyperFrames 0.8.188), Hochformat 1080 × 1920, 42 s, 30 fps.
Die Querformat-Fassung bleibt vorerst im Remotion-Projekt.

## Was auf welcher Ebene übernommen wurde

| Teil | Ebene | In der HyperFrames-App änderbar |
|---|---|---|
| Szenen 1–5, Texte, Handy-Rahmen, Logo, QR-Abschluss | nativ (HTML + GSAP) | jedes Element, Zeiten, Texte, Farben (Variablen) |
| App-Aufnahmen (PNG, Kartenflug-MP4) | Medien | Zeit, Ausschnitt, Reihenfolge |
| Angelszenen (Pexels) | Medien mit Farbkorrektur (`data-color-grading`) | Schnitt, Zeit, Farblook |
| Sprecher (ElevenLabs), Musik, Naturgeräusche, Effekte | Medien (`<audio>`), Absenkung unter dem Sprecher als `data-automation` | Lautstärke, Zeitpunkt, Hüllkurven |

## Bewusste Änderungen gegenüber der Remotion-Fassung (Wunsch: „noch besser aussehen“)

- **Übergänge** (statt Überblendungen):
  - Wellenringe beim Auftreffen des Köders, aus denen sich die App-Szene als Kreis öffnet
  - In-App-Wischen der Bildschirme
  - Lichteinfall in den Fangmoment
  - Abblende-Schnitt vom Steg zum Freilassen
  - „Mitnehmen“: Das Fischbild schrumpft in das Handy, dort erscheint der Fangbuch-Eintrag
- **Typografie:** Jede Zeile tritt anders auf: Wort für Wort aus der Unschärfe, ganze Zeile, von Grau zu Weiß, Buchstabe für Buchstabe beim Namen. Gelandete Titel stehen still.
- **Überschriften je Funktion** mit Nummer (1–4) ersetzen Funktions-Etikett + Dauerzeile „Deine Spots, deine Fänge …“: weniger Text gleichzeitig, passend zum Sprecher.
- **Farblook:** einheitliche Korrektur aller Angelclips (leicht kühler, mehr Tiefe, Vignette 0,14, feines Korn 0,06) über `hyperframes media-treatment`. App-Bildschirme bleiben unverändert (echte Farben).
- **Logo-Abschluss:** Welle zeichnet sich, Fisch schwimmt mit Flossenschlag ein, Auge erscheint, Name baut sich Buchstabe für Buchstabe auf. QR-Code nur eingeblendet, ab 33 s unbewegt.
- **Plattform-Bereich:** Texte und QR-Block liegen im Bereich 168–1330 px (TikTok/Reels-Bedienelemente). Das Handy (520 px breit) reicht unten bis 1495 px; dort liegt nur die untere App-Leiste.
- Das Handy bewegt sich nicht (Wunsch Nutzer); es wird nur eingeblendet.

## Nicht übernommen / Abweichungen

- Remotion-Ausgabe wird durch `../scripts/finalize.mjs` laufen gelassen (Lautheit −14 LUFS, yuv420p); dasselbe gilt hier.
- Kein bildgenauer Vergleich der Gesamtbilder mit der Remotion-Fassung, weil Layout und Übergänge absichtlich neu sind. Verglichen wird der unveränderte Inhalt (QR-Code, App-Bildschirme) – siehe `../README.md`, Abschnitt HyperFrames.
- Shader-Übergänge aus der Bibliothek (`ripple-waves`, `light-leak`) sind Vorführ-Blöcke für Text-Szenen und lassen sich nicht auf Videobilder anwenden; stattdessen GSAP (Kreis-Maske, Lichteinfall-Block `organic-light-leak-overlay`).
