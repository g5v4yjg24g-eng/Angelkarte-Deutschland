# Redaktionsplan – die ersten 90 Tage

**Zeitraum:** Vorbereitung Sa 2026-10-24, Launch-Post So 2026-10-25 18:00, danach Woche 1–13 vom 2026-10-26 bis 2027-01-24 (Start vorgezogen, Entscheidung Nutzer 2026-10-24). Alle Termine stehen im Google-Kalender (Farbe Pfau).
Verschiebt sich der Start (z. B. weil Impressum, Domain oder EUIPO-Prüfung noch fehlen), in `marketing/tools/build_calendar.py` das Datum `START` ändern und neu erzeugen.

**Dateien**
- [beitraege-90-tage.md](beitraege-90-tage.md) – alle 44 Beiträge mit Datum, Plattform, Format, Säule, Thema, Ziel, Hook, Ablauf, CTA, Material, Zeitbedarf und Wiederverwendung.
- [redaktionsplan-90-tage.csv](redaktionsplan-90-tage.csv) – dieselben Daten als Tabelle (Semikolon, UTF-8; öffnet in Excel/Numbers/LibreOffice).
- [auswertung-vorlage.csv](auswertung-vorlage.csv) – Wochenauswertung.
- [redaktionsplan-90-tage.ics](redaktionsplan-90-tage.ics) – **Kalenderdatei** mit allen 44 Beiträgen (Beschreibung mit Hook, Ablauf, CTA, Material), Woche 0 und 13 Wochenauswertungen; Erinnerung 2 h vor jedem Beitrag. Zeiten [A]: Di/Do 18:00, Sa/So 10:00, Auswertung So 20:00. Am zuverlässigsten auf dem iPhone als **Kalenderabo** über jsDelivr (liefert die Datei als `text/calendar`; der direkte GitHub-Link liefert `text/plain`, das lehnt Apple ab): Kalender-App → Kalender → Kalender hinzufügen → Kalenderabo hinzufügen → `https://cdn.jsdelivr.net/gh/g5v4yjg24g-eng/Angelkarte-Deutschland@<Commit>/marketing/content-calendar/redaktionsplan-90-tage.ics` (mit fester Commit-Kennung, nach Änderungen neue Kennung). Sonst Import: iPhone – Datei antippen → „Alle hinzufügen“ (am besten in einen eigenen Kalender „Fangpunkt“); Google Kalender – Einstellungen → Importieren; Outlook – Datei öffnen.

## Rhythmus für eine Person nebenbei

| Tag | Was | Zeit [A] |
|---|---|---|
| **Sonntag** | Wochenauswertung (20 min) · „Beißfenster-Check“-Reel aufnehmen und posten | 50 min |
| **Montag** | Reel für Dienstag schneiden (Aufnahmen vom Wochenende am Wasser) | 45 min |
| **Dienstag** | Reel posten → TikTok + YouTube Shorts; 15 min Kommentare | 20 min |
| **Mittwoch** | Bild/Karussell vorbereiten (Vorlagen aus `templates/`) | 20 min |
| **Donnerstag** | Bild/Karussell posten; Story dazu | 15 min |
| **Fr–Sa** | Am Wasser: 3–5 kurze Clips (Ufer, Rute, Wasser, Hände an der App) für die Woche drauf | nebenbei |
| **Gesamt** | | **ca. 3–4 h/Woche** |

**Batching-Tipp:** Bildschirmaufnahmen der App für 3–4 Reels an einem Abend machen; Naturclips bei jedem Angeltag „auf Vorrat“ filmen (immer 9:16, 4K wenn möglich, je 5–10 s, ruhig halten).

## Vorbereitung (Sa 24.10., vor dem ersten Beitrag)
1. Entscheidungen aus der [README](../README.md#offen) treffen (öffentlich ja/nein, Impressum, Domain, Markenrecherche).
2. Handles sichern (Instagram, TikTok, YouTube, Facebook-Seite) – möglichst überall gleich.
3. Profilbild `profile/profilbild-dark-1080.png` hochladen, Bio aus STRATEGIE §5, Link setzen; Banner aus `brand/`.
4. Instagram auf **Creator-Konto** umstellen (Insights, Link-Sticker) [A].
5. 3 Beiträge vorab posten, damit das Profil nicht leer ist: Motiv 01, Karussell 02, Motiv 04 (alle auf denselben Tag oder über 2 Tage verteilt). Danach startet der Plan.
6. Story-Highlights anlegen: „Start“ (Motiv 10 Story), „Funktionen“ (Stories 02–07), „Ehrlich“ (Story 03).
7. 10 Beta-Tester persönlich anschreiben (Vorlage in `templates/KONTAKT-VORLAGEN.md`).

## Säulen und Verteilung
| Säule | Anteil | Zweck |
|---|---|---|
| Reichweite | ca. 45 % | Reels mit Problem- oder Wissens-Hook für Nicht-Follower |
| Vertrauen | ca. 25 % | Entwicklung, Transparenz, Community-Antworten |
| Erklärung | ca. 15 % | Funktionen verständlich zeigen |
| Nutzergewinnung | ca. 15 % | „Probier’s aus“, Installation, Gruppen |

## Was bei wenigen Followern gilt
- **Reels sind der Hebel**, nicht der Feed: Sie werden auch Nicht-Followern gezeigt [A]. Darum zwei Videos pro Woche.
- **Kommentieren statt warten:** täglich 10 Minuten bei passenden Angel-Accounts sinnvolle Kommentare schreiben (kein „Cool, schau dir meine App an“).
- **Erste 3 Sekunden** sind wichtiger als die Schnittqualität.
- **Konstanz vor Menge:** Lieber drei Beiträge pro Woche über 13 Wochen als zehn in der ersten.
- **Nicht entmutigen lassen:** Neue Profile schwanken stark; erst nach 4 Wochen Muster ableiten.

## Saison-Bezug (November bis Februar)
Winter = Raubfischzeit (Zander, Barsch, Hecht – Schonzeiten je Land beachten), kurze Tage, Wetterwechsel, Hochwasser an Flüssen. Daraus: Luftdruck, Warnungen, Pegel, Jahresrückblick, „neues Fangbuch zum Jahreswechsel“.

## Wöchentliche Auswertung
Siehe [STRATEGIE.md §11](../STRATEGIE.md#11-budget-kennzahlen-und-erfolgsmessung) – Regeln für Wiederholen, Verändern und Stoppen.
