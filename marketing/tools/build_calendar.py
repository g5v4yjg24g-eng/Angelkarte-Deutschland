"""Erzeugt den 90-Tage-Redaktionsplan als CSV (für Tabellenprogramme) und Markdown.

Aufruf (Repo-Root): python3 marketing/tools/build_calendar.py
Startdatum ändern: START unten anpassen (immer ein Montag). Alle Termine verschieben sich mit.
"""

import csv
import datetime as dt
from pathlib import Path

START = dt.date(2026, 11, 9)  # Montag Woche 1 (Woche 0 = Vorbereitung ab 2026-11-02)
OUT = Path(__file__).resolve().parent.parent / "content-calendar"

# Kürzel
IG_R = "Instagram Reel → TikTok + YouTube Shorts (gleiches Video)"
IG_K = "Instagram Karussell → Facebook-Seite (Bilder) · TikTok-Fotomodus"
IG_B = "Instagram Bildbeitrag → Facebook-Seite"
IG_S = "Instagram Story (+ Facebook Story)"
FB_G = "Facebook-Gruppen / Foren (nur wo Eigenwerbung erlaubt)"

DAY = {"Di": 1, "Do": 3, "Sa": 5, "So": 6}

# Woche, Tag, Kanal, Format, Säule, Serie, Thema, Ziel, Hook, Ablauf, CTA, Material, Vorbereitung, Wiederverwendung
P = [
    # --- Woche 1: Start ---
    (1, "Di", IG_B, "Bildbeitrag", "Nutzergewinnung", "Start", "Marken-Launch: Fangpunkt stellt sich vor",
     "Erste Follower aus dem eigenen Umfeld, Profil wirkt bewohnt",
     "Ich hab mir die Angel-App gebaut, die ich selbst haben wollte.",
     "Motiv 01. Caption: wer dahinter steht, warum nicht kommerziell, was sie kann, was (noch) nicht.",
     "Link in der Bio – ausprobieren und ehrlich sagen, was fehlt.",
     "posts/01-launch-feed-1080x1440.png", "20 min", "Story mit Link-Sticker; angepinnt im Profil"),
    (1, "Do", IG_K, "Karussell (6 Bilder)", "Erklärung", "Kurz erklärt", "App-Übersicht in fünf Bildern",
     "Verstehen, was die App kann; Speichern auslösen",
     "Fünf Dinge, die du am Wasser brauchst – in einer App.",
     "Karussell 02-k1 bis k6: Karte, Fangbuch, Wetter, Statistik, Angelrecht.",
     "Speichern für den nächsten Angeltag.",
     "posts/02-karussell/*", "15 min", "angepinnt; Facebook-Album"),
    (1, "So", IG_R, "Reel 15–20 s", "Reichweite", "Kurz erklärt", "Fang in 10 Sekunden eintragen",
     "Reichweite über Nicht-Follower; Kernnutzen zeigen",
     "Fang eintragen, bevor der Fisch zurück im Wasser ist.",
     "Bildschirmaufnahme: Fang erfassen → Stelle tippen → Art → Speichern. Stoppuhr-Einblendung. Siehe Video-Konzept V1.",
     "Link in der Bio.", "Bildschirmaufnahme (Handy), 1 Clip Wasser/Ufer", "60 min",
     "TikTok, YouTube Shorts, Story"),
    # --- Woche 2 ---
    (2, "Di", IG_R, "Reel 20–30 s", "Vertrauen", "Werkstatt-Notiz", "Warum es Fangpunkt gibt",
     "Gesicht/Stimme hinter der App, Glaubwürdigkeit",
     "Meine alte Angel-App war eine einzige HTML-Datei für einen See.",
     "Selfie-Video am Wasser oder Sprechertext über alte/neue App-Aufnahmen: von einem See zu ganz Deutschland, ohne Konto, ohne Werbung.",
     "Folgen, wenn du sehen willst, wie es weitergeht.", "Selfie-Clip, Bildschirmaufnahmen", "60 min",
     "TikTok, Shorts; Text als Facebook-Beitrag"),
    (2, "Do", IG_B, "Bildbeitrag", "Erklärung", "Fangbuch-Freitag", "Digitales Fangbuch",
     "Kernfunktion Fangbuch erklären",
     "Jeder Biss zählt. Auch der verlorene.",
     "Motiv 04. Caption: Fang, Fischkontakt, Fehlbiss, Beobachtung – warum Fehlbisse für die Auswertung wichtig sind.",
     "Wie notierst du bisher deine Fänge? Kommentar.", "posts/04-fangbuch-feed-1080x1440.png", "15 min",
     "Story mit Umfrage „Zettel / Handy / gar nicht“"),
    (2, "Sa", IG_S, "Story-Serie (3)", "Vertrauen", "Frag die Runde", "Umfrage: Wie dokumentierst du Fänge?",
     "Interaktion, Zielgruppenwissen",
     "Ehrlich: Schreibst du deine Fänge auf?",
     "Story 1 Umfrage, Story 2 Quiz „Was zählt als Fischkontakt?“, Story 3 Ergebnis + Link.",
     "Link-Sticker zur App.", "stories/04-fangbuch-story-1080x1920.png", "15 min", "Ergebnis als Beitrag in Woche 3"),
    (2, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Luftdruck der Woche",
     "Wiederkehrender Sonntags-Termin aufbauen",
     "Luftdruck fällt – was heißt das für dein Wochenende?",
     "Bildschirmaufnahme Wetter → Luftdruck-Verlauf. Klar sagen: Zusammenhang ist umstritten; die App zeigt deine eigenen Daten ab 20 Bissen.",
     "Welche Erfahrung hast du mit fallendem Luftdruck?", "Bildschirmaufnahme Wetterseite", "40 min",
     "TikTok, Shorts"),
    # --- Woche 3 ---
    (3, "Di", IG_R, "Reel 25 s", "Reichweite", "Problem am Wasser", "„Wo war nochmal die Stelle?“",
     "Problem-Lösung, hohe Wiedererkennung",
     "Du findest die Stelle vom letzten Mal nicht wieder?",
     "Szene: Ratlos am Ufer (eigene Aufnahme) → Karte → gespeicherte Angelstelle → Fang dort. Siehe V2.",
     "Speichern und beim nächsten Mal ausprobieren.", "Uferclip, Bildschirmaufnahme Karte", "60 min",
     "TikTok, Shorts"),
    (3, "Do", IG_B, "Bildbeitrag", "Erklärung", "Kurz erklärt", "Angelstellen & Heatmap",
     "Datenschutz als Vorteil zeigen",
     "Deine Stellen. Nur auf deinem Handy.",
     "Motiv 07. Caption: Markierungen per Tipp, Heatmap ab 30 Fängen sinnvoll, nichts wird hochgeladen.",
     "Wie viele Stellen hast du im Kopf statt auf dem Handy?", "posts/07-angelstellen-feed-1080x1440.png",
     "15 min", "Story"),
    (3, "So", IG_K, "Karussell (4)", "Vertrauen", "Frag die Runde", "Ergebnis der Umfrage + nächste Frage",
     "Community ernst nehmen",
     "Ihr habt abgestimmt – so dokumentiert ihr eure Fänge.",
     "Folie 1 Ergebnis (nur echte Zahlen aus der Story-Umfrage), Folie 2 was das für die App heißt, Folie 3 neue Frage.",
     "Kommentar: Was fehlt dir in deinem Fangbuch?", "Vorlage 08 (Text-Layout) anpassen", "30 min",
     "Facebook-Seite"),
    # --- Woche 4 ---
    (4, "Di", IG_R, "Reel 30 s", "Reichweite", "Wissen in 30 Sekunden", "Fänge pro Stunde statt Fänge pro Tag",
     "Mehrwert ohne App-Zwang, Statistik-Denke",
     "10 Fische an einem Tag sind nicht gut – wenn du 12 Stunden da warst.",
     "Rechenbeispiel als Texteinblendung, dann Statistik-Screen „Fänge pro Stunde“ mit n = …",
     "Rechnest du deine Angelzeit mit?", "Statistik-Screenshot, Texteinblendungen", "45 min", "TikTok, Shorts"),
    (4, "Do", IG_B, "Bildbeitrag", "Erklärung", "Fangbuch-Freitag", "Statistik",
     "Funktion Statistik erklären",
     "Was wirklich fängt.",
     "Motiv 06. Caption: Mindestmengen und Stichprobengröße – warum die App bei wenigen Fängen „zu wenige Daten“ sagt.",
     "Welcher Köder ist bei dir der heimliche Gewinner?", "posts/06-statistik-feed-1080x1440.png", "15 min",
     "Story"),
    (4, "Sa", FB_G, "Text + 1 Bild", "Nutzergewinnung", "Community", "Vorstellung in 1–2 passenden Gruppen",
     "Erste Tester außerhalb des Umfelds",
     "Ich suche ehrliches Feedback zu meiner kostenlosen Angel-App.",
     "Vorher Gruppenregeln lesen bzw. Admin fragen (Vorlage KONTAKT-VORLAGEN.md). Kein Copy-Paste in viele Gruppen.",
     "Wer Lust hat: testen und sagen, was nervt.", "Motiv 10 oder Karussell-Titelbild", "30 min", "–"),
    (4, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Solunar – Theorie ehrlich erklärt",
     "Reichweite über ein bekanntes Suchthema",
     "Mondphasen und Beißzeiten – was ist dran?",
     "Solunar-Zeiten in der App zeigen, Hinweis „Theorie, wissenschaftlich nicht belegt“ einblenden; eigene Auswertung als Gegenstück.",
     "Glaubst du an Solunar? Ja/Nein in die Kommentare.", "Bildschirmaufnahme Beißfenster", "40 min",
     "TikTok, Shorts"),
    # --- Woche 5 ---
    (5, "Di", IG_R, "Reel 30 s", "Vertrauen", "Ehrlich gesagt", "Warum es (noch) keine Tiefenkarten gibt",
     "Vertrauen durch Transparenz; Abgrenzung",
     "Viele Apps haben Tiefenkarten. Meine nicht. Absichtlich.",
     "Sprechertext: Tiefendaten brauchen eine Lizenz; geschätzte Linien wären keine Messung. Siehe V4.",
     "Kennst du eine freie Quelle? Schreib mir.", "Selfie-Clip oder Text auf Wasserbild", "45 min",
     "Motiv 03 als Bildbeitrag am Donnerstag"),
    (5, "Do", IG_B, "Bildbeitrag", "Vertrauen", "Ehrlich gesagt", "Tiefenkarten: Noch nicht",
     "Haltung zeigen, Hinweise aus der Community sammeln",
     "Tiefenkarten? Noch nicht.",
     "Motiv 03. Caption erklärt, was es heute gibt (Gewässerprofil mit Quelle).",
     "Quelle bekannt? DM.", "posts/03-tiefenkarten-feed-1080x1440.png", "10 min", "Story"),
    (5, "So", IG_R, "Reel 20 s", "Reichweite", "Kurz erklärt", "Gewässer suchen und Profil ansehen",
     "Deutschland-Abdeckung zeigen",
     "Kennst du den Namen von deinem Hausgewässer? Die Karte schon.",
     "Suche „Möhnesee“ o. ä. → Profil: Name, Typ, Fläche, Lage, Quelle OSM. Hinweis: Angaben aus OpenStreetMap.",
     "Such dein Gewässer – Link in der Bio.", "Bildschirmaufnahme Suche/Profil", "40 min", "TikTok, Shorts"),
    # --- Woche 6 ---
    (6, "Di", IG_R, "Reel 30 s", "Reichweite", "Problem am Wasser", "Unwetter beim Ansitz",
     "Sicherheit als Nutzen",
     "Gewitter auf dem See ist kein Abenteuer.",
     "Amtliche Warnungen (DWD) auf der Wetterseite und beim Angeltermin zeigen. Keine Panikmache.",
     "Prüfst du Warnungen vor dem Losfahren?", "Bildschirmaufnahme Warnungen (nur echte, aktuelle)", "40 min",
     "TikTok, Shorts"),
    (6, "Do", IG_B, "Bildbeitrag", "Erklärung", "Beißfenster-Check", "Wetter & Beißfenster",
     "Funktion erklären",
     "Wann beißt es bei dir?",
     "Motiv 05. Caption: Vorhersage, Luftdruck, eigene Auswertung ab 20 Bissen, keine „gut/schlecht“-Wertung.",
     "Wie viele Bisse hast du dieses Jahr notiert?", "posts/05-wetter-beissfenster-feed-1080x1440.png",
     "15 min", "Story"),
    (6, "Sa", IG_S, "Story-Serie (4)", "Vertrauen", "Werkstatt-Notiz", "Ein Tag Entwicklung",
     "Nähe, Persönlichkeit",
     "Heute baue ich …",
     "Fotos vom Schreibtisch/Testgerät, eine Vorher-nachher-Aufnahme, Frage-Sticker.",
     "Frage-Sticker: Was soll als Nächstes kommen?", "Handyfotos", "20 min", "Antworten als Reel in Woche 7"),
    (6, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat festigen",
     "Dein Angelwetter für die Woche – in 20 Sekunden.",
     "Vorhersage „Die nächsten Tage“ scrollen, Luftdruck-Tendenz, ein Satz Einordnung.",
     "Wann gehst du diese Woche ans Wasser?", "Bildschirmaufnahme Wetter", "30 min", "TikTok, Shorts"),
    # --- Woche 7 ---
    (7, "Di", IG_R, "Reel 30 s", "Vertrauen", "Euer Feedback", "Eure Wünsche – was daraus wird",
     "Community-Bindung",
     "Ihr habt gefragt – das kommt (und das nicht).",
     "Antworten aus der Story-Frage vorlesen, ehrlich priorisieren. Nichts versprechen, was nicht geplant ist.",
     "Weitere Wünsche in die Kommentare.", "Screenshots der Antworten (nur mit Einverständnis, sonst anonymisiert)",
     "45 min", "Facebook-Text"),
    (7, "Do", IG_K, "Karussell (5)", "Reichweite", "Wissen in 30 Sekunden", "5 Dinge, die ins Fangbuch gehören",
     "Speicherbarer Mehrwert",
     "Diese 5 Angaben machen dein Fangbuch wirklich nützlich.",
     "Zeit, Stelle, Köder, Ergebnis (auch Fehlbiss), Bedingungen. Letzte Folie: App macht das mit wenigen Tipps.",
     "Speichern.", "Vorlage Text-Layout, 1 Screenshot", "40 min", "Facebook, Pinterest optional"),
    (7, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Pegel – warum Wasserstand keine Tiefe ist",
     "Fachwissen + Funktion Pegel",
     "75 cm Wasserstand heißt nicht 75 cm tief.",
     "Pegelkarte in der App, Erklärung Pegelnullpunkt. Hinweis: nur Bundeswasserstraßen und NRW-Landespegel.",
     "Angelst du an Flüssen? Pegel bei dir schon geprüft?", "Bildschirmaufnahme Pegel", "40 min",
     "TikTok, Shorts"),
    # --- Woche 8 ---
    (8, "Di", IG_R, "Reel 25 s", "Reichweite", "Problem am Wasser", "„War das jetzt Schonzeit?“",
     "Recht-Funktion zeigen, mit klarer Einschränkung",
     "Fisch gefangen – darfst du ihn mitnehmen?",
     "Fang eintragen → Rechts-Hinweis der App mit Paragraf. Einblendung „keine Rechtsauskunft, Erlaubnisschein gilt“. NRW: noch keine Daten.",
     "Kennst du die Schonzeiten in deinem Land?", "Bildschirmaufnahme Fangformular mit Hinweis", "60 min",
     "TikTok, Shorts"),
    (8, "Do", IG_B, "Bildbeitrag", "Vertrauen", "Werkstatt-Notiz", "Hinter den Kulissen: Neu in der App",
     "Fortschritt zeigen",
     "Diese Woche neu in Fangpunkt.",
     "Motiv 08 vorher aktualisieren: nur Funktionen nennen, die live sind.",
     "Was fehlt dir? Kommentar.", "posts/08-entwicklung-feed-1080x1440.png (aktualisieren)", "20 min", "Story"),
    (8, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat", "Angelwetter der Woche in 20 Sekunden.",
     "Wie Woche 6.", "Wann geht's los?", "Bildschirmaufnahme", "30 min", "TikTok, Shorts"),
    # --- Woche 9 ---
    (9, "Di", IG_R, "Reel 30–45 s", "Reichweite", "Fangbuch-Freitag", "Mein Angeljahr in Zahlen",
     "Persönliche Geschichte mit eigenen echten Daten (Jahresrückblick)",
     "Mein Angeljahr in 30 Sekunden – ehrlich, mit allen Schneidertagen.",
     "Eigene Statistik zeigen (nur echte eigene Daten!), Highlights, Fehlbisse, Fänge pro Stunde. Siehe V3.",
     "Wie war dein Jahr? Zahl in die Kommentare.", "eigene Statistik, eigene Fangfotos", "90 min",
     "TikTok, Shorts, Facebook"),
    (9, "Do", IG_K, "Karussell (4)", "Nutzergewinnung", "Frag die Runde", "Zum Jahreswechsel: Fangbuch-Vorsatz",
     "Einstieg zum Jahresstart erleichtern",
     "Neues Jahr, neues Fangbuch?",
     "Folien: Warum aufschreiben, was es bringt, wie schnell es geht, wie du startest.",
     "Starte am 1. Januar mit dem ersten Eintrag.", "Vorlage Text-Layout, Motiv 10", "30 min", "Story"),
    (9, "So", IG_S, "Story-Serie", "Vertrauen", "Frag die Runde", "Morgens oder abends?",
     "Interaktion", "Morgens oder abends?",
     "Motiv 09 als Story mit Umfrage-Sticker; Ergebnis am Mittwoch.",
     "Abstimmen.", "stories/09-community-frage-story-1080x1920.png", "10 min", "Feed-Beitrag Motiv 09"),
    # --- Woche 10 ---
    (10, "Di", IG_B, "Bildbeitrag", "Vertrauen", "Frag die Runde", "Morgens oder abends? (Feed)",
     "Kommentare sammeln", "Morgens oder abends – wann läuft's bei dir besser?",
     "Motiv 09. Kommentare beantworten.", "Antwort in die Kommentare.",
     "posts/09-community-frage-feed-1080x1440.png", "10 min", "–"),
    (10, "Do", IG_R, "Reel 30 s", "Nutzergewinnung", "Kurz erklärt", "App auf den Startbildschirm legen",
     "Hürde „ist doch nur eine Website“ abbauen",
     "Diese App gibt's in keinem Store – und das ist Absicht.",
     "Bildschirmaufnahme iPhone und Android: hinzufügen, starten, ohne Internet Fang eintragen. Siehe V5.",
     "Probier's aus – Link in der Bio.", "Bildschirmaufnahmen auf 2 Geräten", "60 min", "TikTok, Shorts, Story"),
    (10, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat", "Angelwetter der Woche.", "Wie Woche 6.", "Wann geht's los?", "Bildschirmaufnahme",
     "30 min", "TikTok, Shorts"),
    # --- Woche 11 ---
    (11, "Di", IG_R, "Reel 30 s", "Reichweite", "Wissen in 30 Sekunden", "Fehlbisse aufschreiben – warum?",
     "Mehrwert, Kernidee der App",
     "Deine Fehlbisse verraten mehr als deine Fänge.",
     "Erklärung: Bisse zeigen Aktivität; Landequote = Fänge / (Fänge + Kontakte). Statistik-Screen.",
     "Notierst du Fehlbisse?", "Statistik-Screenshot", "40 min", "TikTok, Shorts"),
    (11, "Do", IG_K, "Karussell (6)", "Nutzergewinnung", "Kurz erklärt", "Wiederholung: App-Übersicht (neue Follower)",
     "Neue Follower abholen",
     "Neu hier? Das ist Fangpunkt.",
     "Karussell 02 erneut, Titelfolie aktualisiert, ggf. neue Funktion ergänzen.",
     "Speichern / Link in der Bio.", "posts/02-karussell/*", "15 min", "–"),
    (11, "Sa", FB_G, "Text + Bild", "Nutzergewinnung", "Community", "Update in den Gruppen, in denen es erlaubt war",
     "Tester zurückholen, Feedback",
     "Danke für euer Feedback – das hat sich geändert.",
     "Nur in Gruppen, in denen der erste Beitrag gut ankam. Konkrete Änderungen nennen.",
     "Wer noch nicht getestet hat: gern.", "Motiv 08 aktualisiert", "20 min", "–"),
    (11, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat", "Angelwetter der Woche.", "Wie Woche 6.", "Wann geht's los?", "Bildschirmaufnahme",
     "30 min", "TikTok, Shorts"),
    # --- Woche 12 ---
    (12, "Di", IG_R, "Reel 30 s", "Reichweite", "Problem am Wasser", "Angeltermin planen und Wetter im Blick",
     "Kalender-Funktion zeigen",
     "Samstag Zander – aber wie wird das Wetter am See?",
     "Angelkalender: Termin anlegen, Wetter am Gewässer für 7 Tage, Export in den Handy-Kalender.",
     "Plan deinen nächsten Ansitz.", "Bildschirmaufnahme Kalender", "45 min", "TikTok, Shorts"),
    (12, "Do", IG_B, "Bildbeitrag", "Nutzergewinnung", "Start", "Probier Fangpunkt aus",
     "Konversion",
     "In 30 Sekunden startklar.",
     "Motiv 10. Caption mit Schritt-für-Schritt.",
     "Link in der Bio.", "posts/10-ausprobieren-feed-1080x1440.png", "10 min", "Story mit Link-Sticker"),
    (12, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat", "Angelwetter der Woche.", "Wie Woche 6.", "Wann geht's los?", "Bildschirmaufnahme",
     "30 min", "TikTok, Shorts"),
    # --- Woche 13 ---
    (13, "Di", IG_R, "Reel 30 s", "Vertrauen", "Werkstatt-Notiz", "90 Tage Fangpunkt auf Instagram – ehrliche Bilanz",
     "Transparenz, Bindung",
     "90 Tage, null Werbebudget – so lief's wirklich.",
     "Nur echte Zahlen aus den Insights; was funktioniert hat, was nicht, was als Nächstes kommt.",
     "Was soll ich als Nächstes zeigen?", "Insights-Screenshots (eigene)", "60 min", "Facebook, Story"),
    (13, "Do", IG_K, "Karussell", "Reichweite", "Wissen in 30 Sekunden", "Bestes Reel der 90 Tage neu aufgelegt",
     "Gewinnerformat wiederverwerten",
     "(Hook des besten Reels, leicht verändert)",
     "Das bestlaufende Thema als Karussell oder neues Reel mit anderem Einstieg.",
     "Speichern.", "abhängig vom Gewinner", "40 min", "–"),
    (13, "So", IG_R, "Reel 20 s", "Reichweite", "Beißfenster-Check", "Wochenausblick Wetter",
     "Sonntagsformat", "Angelwetter der Woche.", "Wie Woche 6.", "Wann geht's los?", "Bildschirmaufnahme",
     "30 min", "TikTok, Shorts"),
]

HEAD = ["Woche", "Datum", "Tag", "Plattform", "Format", "Säule", "Serie", "Thema", "Ziel", "Hook",
        "Inhalt und Ablauf", "Call-to-Action", "Benötigtes Material", "Vorbereitung", "Wiederverwendung"]


def rows():
    for w, day, *rest in P:
        date = START + dt.timedelta(weeks=w - 1, days=DAY[day])
        yield [w, date.isoformat(), day, *rest]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = list(rows())
    with open(OUT / "redaktionsplan-90-tage.csv", "w", newline="", encoding="utf-8-sig") as f:
        wr = csv.writer(f, delimiter=";")
        wr.writerow(HEAD)
        wr.writerows(data)
    md = ["# 90-Tage-Redaktionsplan (Beiträge)", "",
          f"Woche 1 beginnt am {START.isoformat()} (Montag). Vorbereitung (Woche 0) und Rhythmus: siehe "
          "[REDAKTIONSPLAN-90-TAGE.md](REDAKTIONSPLAN-90-TAGE.md). Diese Datei wird aus "
          "`marketing/tools/build_calendar.py` erzeugt – Änderungen dort vornehmen.", ""]
    week = None
    for r in data:
        if r[0] != week:
            week = r[0]
            md += ["", f"## Woche {week}", ""]
        md += [f"### {r[1]} ({r[2]}) · {r[7]}", "",
               f"- **Plattform / Format:** {r[3]} · {r[4]}",
               f"- **Säule / Serie:** {r[5]} · {r[6]}",
               f"- **Ziel:** {r[8]}",
               f"- **Hook:** „{r[9]}“",
               f"- **Ablauf:** {r[10]}",
               f"- **CTA:** {r[11]}",
               f"- **Material:** {r[12]}",
               f"- **Vorbereitung:** {r[13]}",
               f"- **Wiederverwendung:** {r[14]}", ""]
    (OUT / "beitraege-90-tage.md").write_text("\n".join(md), encoding="utf-8")
    print(len(data), "Beiträge")


if __name__ == "__main__":
    main()
