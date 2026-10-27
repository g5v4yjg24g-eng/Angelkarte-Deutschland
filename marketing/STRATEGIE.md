# Social-Media-Strategie für Fangpunkt

Stand: 2026-10-23 · Grundlage: Code und Planungsdokumente im Repository, Live-Version auf GitHub Pages, Webrecherche vom 2026-10-23.
Kennzeichnung wie im Projekt: **[V]** verifiziert (mit Quelle/Datum), **[A]** Annahme oder Schätzung, **[O]** offen.

> **Bevor der erste Beitrag online geht, sind vier Punkte zu klären** (Details in §11 und in der [README](README.md#offen)):
> 1. **Die App ist bisher als privat geführt** (PLAN.md M11: „App bleibt privat, daher kein Impressum“). Eine Social-Media-Kampagne macht sie öffentlich. Das ist deine Entscheidung.
> 2. **Impressum und Datenschutzerklärung** für App und Profile, sobald öffentlich geworben wird.
> 3. **Name „Fangpunkt“ bleibt:** DPMAregister ohne Treffer (Suche durch dich, 2026-10-23); EUIPO noch nicht geprüft [O]. `fangpunkt.de` ist vergeben, gehört aber zu einer Website für Architektur-Visualisierung (fremde Branche, geprüft 2026-10-23) [V] → Domain `fangpunkt.app` vorgesehen.
> 4. **Stabiler Link** statt der GitHub-Pages-Vorschauadresse (§9).

---

## 1. Analyse der App (was es wirklich gibt)

| Punkt | Ergebnis |
|---|---|
| Name | **Fangpunkt** – laut PLAN.md E5 ein *Arbeitsname* [V] |
| Logo | Fisch aus einem Master `app/src/design/brand/fish.json`: Körper, Schwanz, zwei Flossen, Kiemenbogen, oranges Auge, türkise Welle. Dieselbe Figur bildet die Ladeanimation (`app/index.html`, Fisch schwimmt ein, Schwanz schlägt, Auge erscheint, Welle zeichnet sich) und alle App-Icons [V] |
| Farben | Tiefwasser `#0B2A33`, Fisch `#E8F4F5`, Auge/Akzent `#F2994A`, Welle `#5CC4D6`, Primär `#0F5C6E` (Design-Tokens „Tiefwasser“) [V] |
| Schriften | Fraunces (Überschriften), Inter (Text), beide SIL OFL 1.1 [V] |
| Form | Progressive Web App: läuft im Browser, lässt sich auf den Startbildschirm legen; nicht in App Stores [V] |
| Öffentlich erreichbar | Ja, technisch: https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/ (HTTP 200 am 2026-10-23) [V]. Laut Workflow eine *Vorschau für Gerätetests*. |
| Geschäftsmodell | Nicht kommerziell, keine Werbung, kein Abo, kein Konto (E3, E8) [V] |
| Datenschutz | Persönliche Daten bleiben auf dem Gerät; kein Tracking; Standort verlässt das Gerät nur gerundet für das Wetter [V] |

### Vorhandene Funktionen (bewerbbar)
- **Karte** für ganz Deutschland mit Gewässerebene aus OpenStreetMap (alle 16 Länder), Suche nach Gewässern und Orten, Gewässerprofil mit Name, Typ, Fläche, Lage und Quelle.
- **Eigene Orte** per Tipp: Angelstelle, Angelsteg, Parkplatz, Zugang, Gefahrenstelle, Sonstiges.
- **Fangbuch**: Fang, Fischkontakt, Fehlbiss, Beobachtung; Art, Länge, Gewicht, Köder, Methode, Bedingungen, bis 6 Fotos (EXIF/GPS wird entfernt); Reiter je Gewässer; Suche; **Erfassung ohne Netz** (per E2E-Test belegt).
- **Sessions** mit Pausen, Köder-Favoriten.
- **Wetter am Fang** (Open-Meteo, Modellwerte), **Pegel am Fang** (PEGELONLINE und Landespegel NRW).
- **Wetter-Bereich**: 7-Tage-Vorhersage, Luftdruck-Verlauf, **amtliche Warnungen des DWD**, Pegel in der Nähe.
- **Beißfenster**: eigene Auswertung (Bisse pro Angelstunde nach Tageszeit, nach Luftdruck/Tendenz und Pegellage) **ab 20 Bissen**; Solunar-Zeiten mit Hinweis „Theorie, wissenschaftlich nicht belegt“.
- **Angelkalender** (Monat/Woche/Tag) mit Wetter am Gewässer und Export in den Handy-Kalender (.ics).
- **Statistik**: Fänge, Bisse, Landequote, Fänge pro Stunde, Arten, Gewässer, Köder, Methoden, größte Fische, Session-Vergleich – mit Mindestmengen und „n = …“.
- **Heatmap** der eigenen Fänge (Warnung unter 30 Fängen).
- **Angelrecht der Länder**: alle 16 Länder „teilweise geprüft“ (Schonzeiten, Mindestmaße, geschützte Arten, Fischereischein; NRW seit 2026-10-25); Warnung beim Erfassen (blockiert nie); immer „keine Rechtsauskunft“.
- **Sicherung**: Export/Import (ZIP/JSON), CSV-Export, Erinnerung.
- Hell/Dunkel, installierbar, barrierearm geprüft.

### Nicht vorhanden – darf nicht beworben werden
- **Tiefenkarten** (bewusst zurückgestellt, bis eine Lizenz geklärt ist).
- **Offline-Karten** (zurückgestellt; die *Karte* ist nicht offline verfügbar, nur die Erfassung).
- **Fischbestimmung per Foto**, **Konten/Cloud-Sync**, **Community-Funktionen** (Teilen, Fangmeldungen anderer), **Gewässerkarten zum Kaufen**, **Vereins-/Pachtregeln je Gewässer**.
- **Rechtsdaten für NRW**.
- App-Store-Versionen.

### Für Videos besonders geeignet
1. Fang in wenigen Tipps erfassen (schnell, sichtbar, Kernnutzen).
2. Karte → Gewässer suchen → Profil.
3. Heatmap ein-/ausschalten (starker visueller Effekt – aber nur mit echten eigenen Daten oder klar als Beispieldaten).
4. Luftdruck-Verlauf und Beißfenster aus eigenen Daten.
5. Rechts-Hinweis beim Erfassen (mit Einschränkungen zeigen).
6. Installation auf dem Startbildschirm + Erfassung im Flugmodus.

---

## 2. Positionierung

**Markenkern:** *Das ehrliche Fangbuch mit Karte – für Angler, die ihre eigenen Daten verstehen wollen, ohne sie herzugeben.*

**Zentraler Nutzen:** Alles, was beim Angeln zählt – Stelle, Biss, Köder, Wetter, Pegel, Regeln – an einem Ort festhalten und später auswerten, kostenlos und ohne Konto.

**Gelöstes Problem:** Fänge und Stellen stehen auf Zetteln, in Notiz-Apps oder nur im Kopf; Wetter, Pegel und Schonzeiten muss man in drei anderen Apps nachsehen. Große Angel-Apps verlangen Konto, Abo oder teilen Fangdaten mit einer Community.

**Warum Fangpunkt statt einer anderen App** (alles belegbar):
1. **Deine Daten bleiben auf deinem Handy.** Keine Anmeldung, keine Cloud, keine Fangmeldungen an andere. Für viele Angler sind gute Stellen ein Geheimnis.
2. **Kostenlos und werbefrei**, weil nicht kommerziell.
3. **Ehrliche Zahlen**: Mindestmengen, Stichprobengröße, keine „besten Köder“-Rankings aus zu wenigen Fängen, Solunar ausdrücklich als Theorie.
4. **Auch Fehlbisse zählen**: Die Auswertung nutzt Fänge, Kontakte und Fehlbisse.
5. **Deutschland-spezifisch**: Gewässer aller Länder, DWD-Warnungen, Pegel, Angelrecht der Länder mit Paragraf und Quelle.

**Abgrenzung** (vgl. §4): Fishbrain setzt auf weltweite Community und Abo, Anglermap/hejfish auf Gewässer und Angelkartenkauf, ALLE ANGELN auf Fangmeldungen und Gewässerstatistiken. Fangpunkt besetzt **„privat, ehrlich, ohne Konto“** – eine Lücke, die keiner der großen Anbieter laut kommuniziert [A, aus §4 abgeleitet].

**Markenpersönlichkeit:** ruhig, kundig, ehrlich, ein bisschen trocken. Ein Angler, der auch programmiert – kein Start-up mit Hochglanz.
**Kommunikationsstil:** Du-Form, kurze Sätze, Fachbegriffe der Szene (Ansitz, Kante, Schneidertag, Fehlbiss), kein Marketingsprech, wenige Emojis (höchstens 🎣 🐟 sparsam). Grenzen offen nennen („gibt’s noch nicht“, „keine Rechtsauskunft“).

**Slogan:** **„Gewässer finden. Fänge festhalten.“** (entspricht der Beschreibung im App-Manifest)

**Alternative Botschaften**
- „Dein Fangbuch. Nur auf deinem Handy.“
- „Jeder Biss zählt. Auch der verlorene.“
- „Ehrliche Zahlen statt Anglerlatein.“
- „Kein Konto. Kein Abo. Keine geteilten Stellen.“
- „Wann beißt es bei *dir*? Deine Daten sagen es – ab 20 Bissen.“
- „Für ganz Deutschland. Kostenlos.“

---

## 3. Zielgruppen (priorisiert)

| Prio | Zielgruppe | Warum | Ansprache |
|---|---|---|---|
| **1** | **Raubfischangler (Spinn-, Jigg-, Dropshot-Angler; Zander, Barsch, Hecht), 20–45** | Wechseln oft Stellen und Köder → Fangbuch, Köder-Statistik und Stellen-Markierungen bringen sofort Nutzen; auf Instagram/TikTok stark vertreten [A]; Winter (Start im November) ist Raubfischsaison | Köder- und Stellenlogik, Fänge pro Stunde, Luftdruck |
| **2** | **Dokumentierer / datenaffine Angler** (führen bereits Fangbuch auf Papier oder in Excel) | Größter Bedarf an genau dieser App; hohe Bindung; Multiplikatoren in Foren | Statistik, CSV-Export, Mindestmengen, Datenschutz |
| **3** | **Technik- und Datenschutz-interessierte Angler** | Teilen gern Werkzeuge, die „ohne Konto“ und „ohne Tracking“ funktionieren; offen für eine PWA | Entwicklungs-Einblicke, Transparenz |
| 4 | Karpfen- und Friedfischangler | Lange Ansitze → Sessions, Pausen, Wetter, Pegel nützlich; aber Community stark markengebunden (Futter/Tackle) [A] | Sessions, Wetter, Angelkalender |
| 5 | Einsteiger | Großes Volumen, aber brauchen vor allem Gewässer-/Kartenkauf und Regeln – die App kann Regeln nur teilweise und keine Erlaubnisscheine [V]; Erwartungsmanagement nötig | Schonzeit-/Mindestmaß-Hinweise mit klarer Einschränkung |

**Begründung der Reihenfolge:** Mit kaum Followern zählt Reichweite über die Algorithmen (Reels/TikTok) **und** schnelle Glaubwürdigkeit. Raubfischangler und Dokumentierer erleben den Nutzen beim ersten Eintrag; Einsteiger würden Funktionen erwarten, die fehlen (Kartenkauf, NRW-Recht), und wären schneller enttäuscht.

**Regionaler Hinweis:** Rechtsdaten fehlen für NRW, der Entwickler-Testsee liegt aber in NRW. Für NRW-Angler die Rechtsfunktion nicht in den Vordergrund stellen, bis M7.2 erledigt ist.

---

## 4. Konkurrenzanalyse

Quellen sind überwiegend Ratgeber-Artikel; Nutzerzahlen und Preise widersprechen sich teilweise und sind **nicht** selbst geprüft.

| Anbieter | Positionierung laut Quellen | Was das für Fangpunkt heißt |
|---|---|---|
| **Fishbrain** | Weltweite Community mit Fangmeldungen auf der Karte, Artbestimmung per Foto, Premium-Abo; Angaben zu Nutzern 15–20 Mio. und zu Preisen widersprüchlich [V: Ratgeber, siehe unten] | Nicht über Community oder Größe konkurrieren. Gegenposition: privat, ohne Konto, ohne Abo. |
| **Anglermap** | Gewässerkarten, Vereine, Bestimmungen, teils Tageskartenkauf in der App [V: Ratgeber] | Kein Kartenkauf in Fangpunkt → nicht als Ersatz darstellen; eher Ergänzung („Karte kaufen dort, Fänge festhalten hier“). |
| **hejfish** | Angelkarten online kaufen, nicht alle Regionen angeschlossen [V: Ratgeber] | Wie oben. |
| **ALLE ANGELN** | Fangbuch, Gewässerstatistiken aus über 1 Mio. Fangmeldungen, Beißzeiten/„Fangfaktor“ für Pro-Nutzer, Pro-Abo (genannt 34,99 €) [V: Ratgeber/Anbieterseite] | Direkter Wettbewerber beim Fangbuch. Unterschied: Fangpunkt teilt keine Daten und wertet nur *deine* Bisse aus. |
| **Fishbuddy, FishFriender, tiddlr, „DAS Fangbuch“** | Angelplätze, 3D-Karten, Mindestmaße, KI-Erkennung (Fishbuddy); Fangtagebuch mit Wetter (FishFriender, tiddlr) [V: Store/Foren] | Fangbuch-Nische ist besetzt; Differenzierung muss über Ehrlichkeit, Datenschutz, Deutschland-Tiefe laufen. |

**Häufige Inhalte in der Nische** [A, Beobachtung typischer Accounts, nicht systematisch ausgezählt]: Fangfotos „Fisch in die Kamera“, Köder-Tests, Unterwasseraufnahmen, Echolot-/Tiefenkarten-Screens, Beißzeit-Prognosen, Gewinnspiele mit Tackle.

**Geeignete Formate für eine App:** kurze Bildschirmaufnahmen mit Problem-Hook, „Tipp der Woche“-Karussells, wiederkehrende Wetter-Ausblicke, ehrliche Entwickler-Einblicke, Umfragen.

**Differenzierung:** Transparenz („was es noch nicht gibt“), Datenschutz, ehrliche Statistik, Gesicht des Entwicklers, Deutschland-Bezug (DWD, Pegel, Landesrecht).

**Fehler, die vermieden werden müssen**
- Funktionen versprechen, die fehlen (Tiefenkarten, Offline-Karten, Fischerkennung).
- Beißzeit-„Prognosen“ als sicher darstellen; Solunar ohne Hinweis.
- Rechtsangaben ohne „keine Rechtsauskunft“ und ohne Quelle.
- Fangfotos fremder Leute ohne Erlaubnis, Musik ohne Lizenz.
- Spam in Facebook-Gruppen und Foren (führt zu Sperren und schlechtem Ruf).
- Konkrete Stellen fremder Angler oder sensible Laichplätze zeigen.
- Fische lange außerhalb des Wassers für Fotos halten (Tierschutz; schadet dem Ruf).

Quellen: [AngelEinsteiger – Die 7 besten Angel-Apps 2026](https://www.angeleinsteiger.de/ratgeber/beste-angel-apps-einsteiger-2026) · [Fischfindertest – Angel-Apps 2026](https://www.fischfindertest.de/angeln/zander-angeln/nuetzliche-apps-zum-angeln/) · [Angelstratege – Angel-App-Vergleich 2026](https://angelstratege.com/en/angel-app-vergleich.html) · [GilledIt – Best Fishing Apps 2026](https://www.gilledit.com/us/blog/best-fishing-apps) · [ALLE ANGELN – Fangbuch](https://www.alleangeln.de/app/?p=5176) · [ALLE ANGELN – Fangfaktor](https://www.alleangeln.de/forum/neues-bei-alle-angeln/app-update-der-fangfaktor-ist-da-16383) · [Fishbuddy im App Store](https://apps.apple.com/DE/app/id1666853528) · [Barsch-Alarm – Apps beim Angeln](https://www.barsch-alarm.de/community/threads/unterst%C3%BCtzende-apps-beim-angeln.38248) (alle abgerufen 2026-10-23)

---

## 5. Plattformstrategie

**Prinzip „ein Video, drei Kanäle“:** Jede Woche entstehen **zwei vertikale Videos** (9:16) und **ein Bild/Karussell**. Die Videos laufen unverändert als Instagram Reel, TikTok und YouTube Short; Bilder gehen auf Instagram und die Facebook-Seite. Nur die Caption wird pro Kanal leicht angepasst (TikTok kürzer, YouTube mit Titel).

| Plattform | Rolle | Priorität | Begründung |
|---|---|---|---|
| **Instagram** | Heimat: Profil, Feed, Stories, Link in der Bio | **1 – sofort** | Reels erreichen Nicht-Follower; Karussells werden gespeichert; Stories für Umfragen und Links [A] |
| **TikTok** | Reichweite für Reels | **1 – sofort (Repost)** | Neue Accounts bekommen Reichweite unabhängig von Followern [A]; kein Mehraufwand |
| **YouTube Shorts** | Reichweite + Suche | **2 – sofort (Repost)** | Videos sind über Suche lange auffindbar [A]; später längere Erklärvideos möglich |
| **Facebook-Seite** | Nebenbei spiegeln | 3 | Ältere Angler, Vereine [A]; kaum Eigenreichweite |
| **Facebook-Gruppen, Foren (Anglerboard, Barsch-Alarm)** | Vertrauen, Feedback, erste Tester | **1 – aber dosiert** | Dort sind die Dokumentierer; Eigenwerbung nur nach Regeln/Admin-Erlaubnis, höchstens alle paar Wochen |

**Formate je Plattform**
- Reels/TikTok/Shorts: 15–35 s, Hook in den ersten 1–2 s, Untertitel eingebrannt, Text oben und unten freihalten (UI-Elemente).
- Feed: 3:4 (1080 × 1440) – seit 2025 zeigt das Profilraster 3:4; 4:5 (1080 × 1350) bleibt im Feed möglich [V: Ratgeber, keine offizielle Instagram-Angabe gefunden]. Beide Größen liegen in `posts/`.
- Stories: 1080 × 1920, oben ca. 250 px und unten ca. 340 px frei von wichtigen Inhalten [A, verbreitete Praxis].
- Profilbild: quadratisch hochladen (1080 px), wird rund zugeschnitten [A].

Quellen Formate: [Dreikon – Instagram-Bildgrößen 2026 (PDF)](https://www.dreikon.de/site/assets/files/4581/dreikon-instagram-bildgroessen-2026-03-v100-en.pdf) · [Sked Social – Instagram Post Size Guide 2026](https://skedsocial.com/blog/best-instagram-image-and-video-size-recommendations.md) · [Louise Myers – Instagram image size](https://louisem.com/37587/whats-the-best-instagram-image-size) · [socialk.it – Reel-Größe](https://socialk.it/de/sizes/instagram-reel-size) (abgerufen 2026-10-23). **[O]** TikTok-, YouTube- und Facebook-Maße vor dem Hochladen in der jeweiligen Hilfe prüfen; die Banner in `brand/` folgen den bekannten Maßen (YouTube 2560 × 1440 mit sicherer Mitte, Facebook-Titelbild 820 × 312 doppelt aufgelöst) [A].

**Profiltexte (Vorschlag)**
- Name: `Fangpunkt – Angel-App`
- Bio: `Gewässer finden. Fänge festhalten. 🎣 Kostenlose Angel-App für ganz Deutschland · ohne Konto · Daten bleiben auf deinem Handy · gebaut von einem Angler` + Link
- Handle: `@fangpunkt` bevorzugt, sonst `@fangpunkt.app` **[O]** Verfügbarkeit auf allen Plattformen am selben Tag prüfen und sichern.

---

## 6. Wiederkehrende Content-Formate

Neun Serien; jede mit mindestens drei Ideen. Alle zeigen nur vorhandene Funktionen.

### 1. „Kurz erklärt“ – eine Funktion in 20 Sekunden
Bildschirmaufnahme + ein Satz Nutzen. *Ideen:* (a) Fang in 10 Sekunden eintragen · (b) Gewässer suchen und Profil mit Quelle · (c) Köder-Favoriten: gleicher Köder mit einem Tipp · (d) Angeltermin in den Handy-Kalender · (e) Sicherung exportieren, damit nichts verloren geht.

### 2. „Problem am Wasser“ – Alltagsproblem → Lösung
Gespielte Szene am Ufer, dann App. *Ideen:* (a) „Wo war nochmal die Stelle?“ → Angelstelle · (b) „War das jetzt Schonzeit?“ → Rechts-Hinweis (mit Einschränkung) · (c) Gewitter beim Ansitz → DWD-Warnung · (d) Funkloch am See → Erfassung ohne Netz · (e) „Welcher Köder lief im Herbst?“ → Statistik.

### 3. „Werkstatt-Notiz“ – Einblicke in die Entwicklung
*Ideen:* (a) Warum ich die App gebaut habe · (b) Ein Wunsch aus den Kommentaren wird umgesetzt (nur wenn es stimmt) · (c) Vorher/nachher: alte Ein-See-App vs. heute · (d) Warum es keine Konten gibt · (e) Woher die Gewässerdaten kommen (OpenStreetMap, Danke an die Mitwirkenden).

### 4. „Wissen in 30 Sekunden“ – Angelwissen ohne App-Zwang
*Ideen:* (a) Fänge pro Stunde statt Fänge pro Tag · (b) Fehlbisse aufschreiben – warum · (c) Pegel ist keine Wassertiefe · (d) 5 Dinge, die ins Fangbuch gehören · (e) Landequote verstehen. Fachaussagen nur, wenn belegbar; Meinungen als Meinung kennzeichnen.

### 5. „Gewässer & Stellen“ (statt Tiefenkarten)
Tiefenkarten gibt es nicht. Stattdessen: *Ideen:* (a) „Ehrlich gesagt: warum keine Tiefenkarten“ · (b) Eigene Stellen markieren: Angelstelle, Steg, Parkplatz, Gefahrenstelle · (c) Heatmap meiner Saison (nur eigene echte Daten) · (d) Fangbuch-Reiter je Gewässer · (e) Unbekanntes Gewässer selbst benennen.

### 6. „Fangbuch-Freitag“ – Fangbuch, Statistik, Angelhistorie
*Ideen:* (a) Mein Angeljahr in Zahlen (echt, mit Schneidertagen) · (b) Session-Vergleich: Morgen- vs. Abendansitz · (c) Größte Fische: gemessen und geschätzt getrennt – warum · (d) Köder-Tabelle mit n.

### 7. „Beißfenster-Check“ – Wetter & Beißfenster (Sonntags)
*Ideen:* (a) Wochenausblick Wetter in 20 s · (b) Luftdruck fällt – was meine Daten sagen · (c) Solunar ehrlich erklärt · (d) Pegel nach Regen. Immer: Vorhersage = Modellwert, eigene Auswertung erst ab 20 Bissen, keine Garantie.

### 8. „Frag die Runde“ – Community
*Ideen:* (a) Morgens oder abends? · (b) Zettel, Handy oder gar nicht? · (c) Welche Funktion fehlt dir? · (d) Dein Wintergewässer: See, Fluss oder Kanal? · (e) Challenge „Schreib im Januar jeden Biss auf“ – Ergebnisse freiwillig in den Kommentaren.

### 9. „Regel der Woche“ (vorsichtig)
Eine Schonzeit oder ein Mindestmaß eines Landes – **nur aus den Landesdateien der App mit Paragraf und Link**, Hinweis „keine Rechtsauskunft, maßgeblich sind amtlicher Text und Erlaubnisschein“. *Ideen:* (a) Schonzeit Zander in Land X · (b) ganzjährig geschützte Art · (c) Fischereischein-Regel eines Landes. **Nicht für NRW**, solange keine Daten vorliegen.

---

## 7. 90-Tage-Plan (Überblick)

Ausführlich: [content-calendar/REDAKTIONSPLAN-90-TAGE.md](content-calendar/REDAKTIONSPLAN-90-TAGE.md) und alle 44 Beiträge mit Hook, Ablauf, CTA, Material und Zeitbedarf in [content-calendar/beitraege-90-tage.md](content-calendar/beitraege-90-tage.md) bzw. als Tabelle [redaktionsplan-90-tage.csv](content-calendar/redaktionsplan-90-tage.csv).

- Rhythmus: **Di Reel · Do Bild/Karussell · So Reel („Beißfenster-Check“)** + 2–3 Stories pro Woche. Zeitbedarf ca. **3–4 Stunden pro Woche** [A].
- Phase 1 (Woche 1–4): Vorstellen, Kernfunktionen, erste Tester.
- Phase 2 (Woche 5–8): Vertrauen (Transparenz, Entwicklung), Problem-Lösung-Reels.
- Phase 3 (Woche 9–13): Jahreswechsel-Thema „neues Fangbuch“, Nutzergewinnung, Gewinnerformate wiederholen.

---

## 8. Werbevideos

Fünf Konzepte mit Szenenplan, Sprechertext und Untertiteln: [videos/VIDEO-KONZEPTE.md](videos/VIDEO-KONZEPTE.md). Es wurde **kein fertiges Video produziert** – nur Konzepte und das Bildmaterial (Screenshots, Motive) dafür.

---

## 9. Link-, QR-Code- und Zugriffsstrategie

**Ist-Zustand:** Die App ist unter `https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/` erreichbar [V 2026-10-23]. Diese Adresse hängt am GitHub-Konto- und Repository-Namen und ist als Vorschau gedacht. Ändert sich einer davon, sind alle gedruckten QR-Codes und Links kaputt.

**Empfehlung (Entscheidung nötig, Kosten):**
1. **Eigene Domain** registrieren (z. B. `fangpunkt.app` – DNS-Abfrage am 2026-10-23 ohne Eintrag, *Verfügbarkeit nicht geprüft* [O]; `fangpunkt.de` ist vergeben [V]). Kosten je nach Endung etwa 10–25 €/Jahr [A]. GitHub Pages unterstützt eigene Domains ohne Zusatzkosten [A].
2. Die Domain zeigt auf die App. Für Kampagnen statische Unterseiten als **Weiterleitungen** anlegen, z. B. `…/ig`, `…/tt`, `…/yt`, `…/flyer` → App mit `?utm_source=instagram&utm_campaign=start`.
3. **Messbarkeit:** Die App hat bewusst *kein* Tracking, und GitHub Pages liefert keine Zugriffsstatistik. Ohne zusätzliche Entscheidung sind messbar: Link-Klicks und Profilaufrufe in den Plattform-Statistiken. Wer Zugriffe auf der Website zählen will, braucht einen datenschutzfreundlichen Zähler (z. B. selbst gehostet oder ein cookieloser Dienst) – **das ist eine Datenschutz-Entscheidung**, laut CLAUDE.md nur mit deiner ausdrücklichen Freigabe, mit Eintrag auf der Datenschutzseite und im Test `privacy.spec.ts`.
4. **Spätere App-Store-Links:** Gibt es nicht und sind nicht geplant. Falls doch, wird die Weiterleitungsseite zur kleinen Landingpage mit Store-Buttons – die gedruckten QR-Codes bleiben gültig.

**QR-Code: noch nicht erstellt.** Grund: Die endgültige Zieladresse steht nicht fest. Erstellbar, sobald (a) die Domain registriert und auf die App geschaltet ist **oder** (b) du ausdrücklich bestätigst, dass die GitHub-Pages-Adresse dauerhaft bleibt. Dann: QR-Code auf die kurze Kampagnen-URL (`…/flyer`), Fehlerkorrektur M, dunkles Modul `#0B2A33` auf `#FFFFFF`, Fisch nicht in den Code einbauen (Lesbarkeit).

---

## 10. Community-Aufbau und Kooperationen

**Grundsätze:** erst geben, dann fragen; überall offenlegen, dass du der Entwickler bist; keine gekauften Follower, keine Fake-Kommentare, keine erfundenen Bewertungen.

1. **Beta-Tester (Woche 1–6):** 10–20 Angler aus dem Umfeld und aus Foren direkt ansprechen. Bitte: zwei Wochen alles eintragen, dann 5 Fragen beantworten (Formular, siehe unten). Danke öffentlich (nur mit Einverständnis, ohne Stellen).
2. **Feedback-System:** Ein Kanal reicht: Instagram-DM oder ein kostenloses Formular. **[O]** In der App gibt es derzeit keinen Feedback-Link; das wäre eine kleine App-Änderung (separater PR, falls gewünscht). Wünsche öffentlich sammeln und ehrlich priorisieren (Serie „Euer Feedback“).
3. **Angelvereine:** Vereine haben Mitglieder, die Fangbücher führen müssen oder wollen [A]. Angebot: kurze Vorstellung beim Vereinsabend oder im Vereinsnewsletter; **klar sagen, dass die App keine Vereinsfangmeldung ersetzt** und keine Daten an den Verein überträgt. Vorlage in [templates/KONTAKT-VORLAGEN.md](templates/KONTAKT-VORLAGEN.md).
4. **Gruppen und Foren:** Regeln lesen, Admins vorher fragen, ein ausführlicher, ehrlicher Beitrag statt vieler kurzer; auf jede Rückfrage antworten; Update-Beitrag nur, wenn sich etwas geändert hat.
5. **Creator-Kooperationen:** Kleine Creator (1 000–20 000 Follower) aus dem Raubfischbereich, die Fangdaten ohnehin zeigen [A]. Angebot: App zeigen, ehrlich bewerten lassen – **ohne Bezahlung keine Pflicht zum Posten**. Wird etwas gegen Leistung gezeigt (auch Sachleistung), muss es als Werbung gekennzeichnet werden (§ 5a Abs. 4 UWG; Plattform-Kennzeichnung „Bezahlte Partnerschaft“) [A, keine Rechtsauskunft].
6. **Nutzerbeiträge:** Nur mit ausdrücklicher, schriftlicher Zustimmung (DM-Antwort genügt als Nachweis, Screenshot sichern); Personen auf Fotos müssen einverstanden sein; Stellen, Kennzeichen und Gesichter Dritter unkenntlich machen.
7. **Gewinnspiele:** In der Startphase **nicht empfohlen** – Aufwand (Teilnahmebedingungen, Datenschutz, Versand), Risiko gekaufter Teilnehmer, und eine kostenlose App hat nichts zu verlosen. Später möglich (z. B. Köderset), dann mit Teilnahmebedingungen, Hinweis, dass Instagram/Meta nicht beteiligt ist, Altersgrenze, Datenlöschung nach Auslosung, keine „Markiere 3 Freunde“-Pflicht als einzige Teilnahmeform [A, keine Rechtsauskunft].
8. **Transparenz:** Jeden Monat eine ehrliche „Werkstatt-Notiz“: was neu ist, was nicht klappt, was nicht kommt.

**Feedback-Fragebogen (5 Fragen):** (1) Wie oft hast du die App genutzt? (2) Was hast du eingetragen? (3) Was war umständlich? (4) Welche Funktion fehlt am meisten? (5) Würdest du sie einem Angelkollegen empfehlen – warum (nicht)?

---

## 11. Budget, Kennzahlen und Erfolgsmessung

### Szenarien (alle Beträge Schätzungen [A])

| Szenario | Kosten pro Monat | Inhalt | Wann |
|---|---|---|---|
| **A – kostenlos** | 0 € (+ einmalig Domain ca. 10–25 €/Jahr) | Organische Beiträge nach Plan, Gruppen, Beta-Tester, Handy + kostenlose Schnittprogramme | Start, mindestens die ersten 8 Wochen |
| **B – kleines Budget** | 50–150 € | 2–3 beste organische Reels als Anzeige („Beitrag bewerben“), Zielgebiet Deutschland, Interessen Angeln/Sportfischen, Laufzeit je 5–7 Tage, 5–10 € pro Tag | Erst wenn ein Reel organisch überdurchschnittlich lief (Wiedergabedauer, Speichern) |
| **C – Skalierung** | 200–500 € | Gewinner-Anzeigen weiterlaufen lassen, A/B-Test von Hooks, 1–2 bezahlte Kooperationen mit kleinen Creatorn (Preise individuell, vorher anfragen) | Nur wenn Kosten pro Link-Klick und Rückmeldungen aus B tragbar sind |

Hinweise: Bezahlte Anzeigen und Kooperationen ändern nichts an „nicht kommerziell“, solange die App kein Geld einnimmt; trotzdem vor Szenario B die Nutzungsbedingungen von Open-Meteo erneut prüfen [O]. Konkrete Klickpreise lassen sich nicht seriös vorhersagen – sie ergeben sich erst aus den eigenen Anzeigen.

### Kennzahlen
| Ebene | Kennzahl | Woher |
|---|---|---|
| Reichweite | Konten erreicht, Anteil Nicht-Follower | Plattform-Insights |
| Aufmerksamkeit | Durchschnittliche Wiedergabedauer, Anteil bis Sekunde 3, Abschlussrate | Reels/TikTok/Shorts-Statistik |
| Interesse | Speichern, Teilen, Kommentare, Profilaufrufe | Insights |
| Klick | Link-Klicks in der Bio / Story-Link-Taps | Insights |
| Nutzung | **Nicht messbar ohne Tracking.** Ersatz: Rückmeldungen, Fragebogen, DMs „hab’s installiert“ | manuell |
| Bezahlt | Kosten pro Link-Klick; Kosten pro Rückmeldung | Anzeigenmanager + manuell |

**Keine Zielwerte für Reichweite oder Downloads** – dafür fehlt jede belastbare Grundlage. Ziel der ersten 90 Tage ist ein *Verlauf*: Welche Serien bringen Wiedergabedauer, Speichern und Rückmeldungen?

### Wöchentliche Auswertung (Sonntag, 20 Minuten)
1. Tabelle `content-calendar/auswertung-vorlage.csv` ausfüllen (je Beitrag: Reichweite, Ø Wiedergabedauer, Speichern, Teilen, Kommentare, Profilaufrufe, Link-Klicks).
2. Beitrag mit der besten **Wiedergabedauer** und der besten **Speicherquote** markieren.
3. Entscheidungsregeln:
   - **Wiederholen** (neuer Hook, gleiches Thema, 2–4 Wochen später): Wiedergabedauer oder Speichern deutlich über deinem eigenen Durchschnitt der letzten 4 Wochen.
   - **Verändern** (anderer Hook in den ersten 2 Sekunden, kürzer, anderes Titelbild): viele Aufrufe, aber niedrige Wiedergabedauer – oder hohe Wiedergabedauer, aber kaum Aufrufe.
   - **Nicht weiterverfolgen:** dreimal hintereinander in allen Kennzahlen unter dem eigenen Durchschnitt.
4. Kommentare und DMs mit Funktionswünschen in eine Liste übernehmen.
5. Plan der nächsten Woche bei Bedarf anpassen (Gewinnerformat statt schwächstem Beitrag).

---

## 12. Rechtliche und praktische Prüfung (keine Rechtsauskunft)

| Thema | Empfehlung |
|---|---|
| **Impressum** | Wer geschäftsmäßig Telemedien anbietet, braucht ein Impressum (§ 5 DDG). Ob ein nicht kommerzielles Hobbyprojekt mit Werbekampagne darunter fällt, ist nicht eindeutig [A]. Sicherer Weg: Impressum auf der App-/Landingpage und Link aus allen Profilen. **[O] Entscheidung + ggf. Beratung.** |
| **Datenschutz** | Datenschutzseite der App existiert (`/mehr/datenschutz`). Für öffentliche Profile: Plattformen verarbeiten Daten der Besucher; bei Facebook-Seiten besteht gemeinsame Verantwortung mit Meta [A]. Keine Tracking-Pixel/Analytics ohne Entscheidung. |
| **Schriften** | Fraunces und Inter, SIL OFL 1.1 – frei nutzbar, auch in Grafiken; Lizenztexte liegen in `brand/fonts/` [V]. |
| **Musik** | Nur Musik aus den Bibliotheken der Plattform (bei Unternehmens-/Creator-Konten auf „kommerziell nutzbar“ achten) oder lizenzfreie Musik mit dokumentierter Lizenz. Keine Charts-Songs in Anzeigen. |
| **Fotos/Videos** | Eigene Aufnahmen bevorzugen. Fremde Bilder nur mit Lizenz und Nachweis. KI-Bilder als solche kennzeichnen, wenn sie echt wirken könnten (Plattformregeln zu KI-Inhalten) [A]. |
| **Personen** | Erkennbare Personen nur mit Einwilligung (KUG/DSGVO); Kinder nur mit Einwilligung der Eltern. |
| **Kartendaten** | Screenshots der Karte zeigen OpenStreetMap-Daten (ODbL) und OpenFreeMap: Vermerk „© OpenStreetMap-Mitwirkende“ in Caption oder Bild nennen. Wetter: Open-Meteo (CC BY 4.0), Warnungen: DWD (CC BY 4.0) – in Captions der Wetter-Motive genannt. |
| **Werbekennzeichnung** | Eigene App im eigenen Profil: keine Kennzeichnung nötig, aber offen sagen, dass du sie entwickelst. Kooperationen mit Gegenleistung: „Werbung“/„Anzeige“ + Plattform-Tool. |
| **Gewinnspiele** | Teilnahmebedingungen, Datenschutzhinweis, Ausschluss der Plattform-Haftung, Altersgrenze – siehe §10.7. |
| **Marke** | DPMAregister: kein Treffer für „Fangpunkt“ (Suche durch dich, 2026-10-23). Offen: EUIPO (eingetragene Unionsmarken gelten auch in Deutschland) und ähnlich klingende Marken in Klassen 9/42 [O]. Eine Anmeldung der eigenen Marke ist optional (Kosten, DPMA-Gebühr prüfen). Social-Handles früh sichern [O]. Eine Websuche fand keine Angel-App dieses Namens; „Fangpoint“ und „Angelpunkt“ wurden verworfen. |
| **Fremde Marken** | Keine Logos von Fishbrain & Co. in Motiven; Vergleiche nur sachlich und ohne Herabsetzung (§ 6 UWG) [A]. |
| **Angelrecht** | In jedem Beitrag mit Regeln: „Keine Rechtsauskunft. Maßgeblich sind der amtliche Text und dein Erlaubnisschein.“ |
| **Tierschutz** | Fische schonend behandeln und zeigen; keine Szenen, die gegen das Tierschutzgesetz verstoßen könnten. |
