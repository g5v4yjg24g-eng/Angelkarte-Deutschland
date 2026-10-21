# DATA_SOURCES – Karten, Gewässer, Tiefen, Recht, Wetter

Stand der Prüfung: 2026-10-21 · **[V]** am angegebenen Link geprüft · **[A]** Annahme · **[O]** offen, mit konkreter Prüfaufgabe

> Preise, Limits und Lizenztexte ändern sich. Jede Quelle wird **vor ihrer Integration** erneut geprüft, und das Prüfdatum wird hier aktualisiert.

## 0. Datenstufen für Gewässer

| Stufe | Bedeutung | Quelle (Plan) | Anzeige im Profil |
|---|---|---|---|
| **1 – Geografisch bekannt** | Name/Typ/Geometrie existieren in einer offenen Geodatenquelle | OSM (Pipeline) | Badge „Kartengewässer" |
| **2 – Detailinformationen** | Belastbare Sachdaten (Fläche aus Geometrie, Tiefe max./mittel aus amtlicher Quelle, Arten-Nachweise aus Monitoring) | Amtliche Datensätze, GBIF-Monitoring | „Daten aus amtlichen Quellen", je Feld mit Quelle |
| **3 – Angelinformationen** | Konkrete Angaben zur Befischung (Verein, Erlaubnisschein-Ausgabe, Besatz) | Redaktionell, Vereine/Verbände mit Zustimmung | „Angelinfos (Stand …)" |
| **4 – Rechtlich geklärt** | Wer ist fischereiberechtigt, wo und unter welchen Bedingungen darf geangelt werden | Nur mit verifizierter Quelle oder Kooperation | „Angeln geregelt – Quelle …" |

Die App leitet **keine** höhere Stufe aus einer niedrigeren ab. Ein OSM-Tag `leisure=fishing` ist z. B. kein Beleg für eine Angelerlaubnis.

---

## 1. Basiskarte

| Option | Kosten | Limits | Lizenz/Bedingungen | Offline | Bewertung |
|---|---|---|---|---|---|
| **OSM-Standardkacheln** `tile.openstreetmap.org` | 0 € | Best Effort, kein SLA; Sperre bei Missbrauch ohne Vorwarnung | Attribution sichtbar; **kein Prefetch, kein „für offline herunterladen"**; Caching nur betrachteter Kacheln mit Header-Beachtung; Referer nicht unterdrücken [V: operations.osmfoundation.org/policies/tiles] | Nein | Nur Raster. Für Vektor-Overlay-Architektur ungeeignet. **Nicht verwenden.** |
| **OpenFreeMap** (öffentliche Instanz) | 0 € (spendenfinanziert) | „no limits on the number of map views or requests"; Offline-Download-Grenze 3 000 Kacheln/50 MB je Download [V: openfreemap.org] | Projekt MIT, Daten OSM (ODbL); kein Key, keine Cookies [V] | Begrenzt erlaubt [V] | **Empfehlung MVP.** Risiko: keine Garantie [A]. |
| **Protomaps-PMTiles selbst gehostet** | Speicher + Traffic des Hosters | Keine fremden Limits | ODbL Produced Work, OSM-Attribution [V: docs.protomaps.com/basemaps/downloads]; Planet ≈ 120 GB (z0–15), Ausschnitt per `pmtiles extract` [V] | **Ja** (eigene Hoheit) | **Empfehlung ab M10.** [O] Größe des Deutschland-Ausschnitts messen (Spike). |
| Kommerziell (MapTiler, Stadia, Mapbox …) | Abhängig vom Tarif | Abhängig vom Tarif | AGB des Anbieters | Meist eingeschränkt | Nur falls E2(a/b) scheitert. [O] Tarife nicht geprüft. |

**Entscheidung (Vorschlag):** OpenFreeMap-Style `liberty`/`positron` [O: Style-Namen bei Integration prüfen] über `BasemapProvider`. Ein Wechsel ist reine Konfiguration.

---

## 2. Gewässer (Geometrie und Namen)

| Quelle | Inhalt | Abdeckung | Lizenz | Technik | Bewertung |
|---|---|---|---|---|---|
| **OpenStreetMap via Geofabrik** | Seen, Teiche, Flüsse, Kanäle, Talsperren mit Namen; Orte | Sehr hoch, auch Kleingewässer [A: Stichprobe in S1] | **ODbL 1.0** [V: download.geofabrik.de] | `germany-latest.osm.pbf` ≈ 4,5 GB, täglich neu; Länderauszüge 20 MB (Bremen) bis 873 MB (NRW) [V] | **Primärquelle Stufe 1.** |
| Overpass API (öffentlich) | Wie OSM, live | – | ODbL | Empfehlung: < 10 000 Abfragen und < 1 GB pro Tag, bei regelmäßiger Nutzung durch 100 teilen; gilt für **alle Nutzer einer App zusammen**; kommerziell → selbst hosten oder bezahlen [V: wiki.openstreetmap.org/wiki/Overpass_API] | **Nicht zur Laufzeit.** Höchstens für Entwickler-Stichproben. |
| Nominatim (öffentlich) | Geocoding | – | ODbL | Max. 1 Anfrage/s für die gesamte App; **Autocomplete verboten**; Caching Pflicht [V: operations.osmfoundation.org/policies/nominatim] | **Nicht verwenden.** Eigener Suchindex (ARCHITECTURE §6.3). |
| Photon (komoot, öffentlich) | Geocoding mit Autocomplete | – | ODbL-Daten; Software Apache 2.0 | Fair Use, Drosselung, keine Verfügbarkeitsgarantie [A: nur aus Drittquellen bestätigt, Originalbedingungen nicht gefunden] | Fallback, falls der eigene Index scheitert. [O] Originalbedingungen prüfen. |
| **BKG DLM250** (ATKIS) | Gewässer 1:250 000 | Bund, nur größere Gewässer | GeoNutzV, kostenfrei; Quellvermerk „© GeoBasis-DE / BKG <Jahr>" [V: Metadaten gdk.gdi-de.org, Datensatz A912C808…] | WFS und Download (NAS, Shape) | Optional zum Abgleich der Namen großer Gewässer. Kein Mehrwert gegenüber OSM für Kleingewässer. |
| ATKIS Basis-DLM der Länder | Gewässer in hoher Genauigkeit | Je Land | Je Land unterschiedlich (z. B. Brandenburg Gewässernetz dl-de/by-2.0, Berlin teils dl-de/zero-2.0) [A: aus Sekundärquelle, O: je Land prüfen] | WFS/Download | P2: Nur bei Bedarf für amtliche Namen/IDs. |
| **EU-Hydro (Copernicus)** | Gewässerflächen und Flussnetz Europa | Europa, ~2006–2012 | Copernicus-Bedingungen: Quelle nennen, Änderungen kennzeichnen, keine EU-Billigung suggerieren [V: Katalogeintrag sdi.eea.europa.eu] | GDB/GPKG je Einzugsgebiet, v1.3 (Nov. 2020) [V] | Veraltet, grob. **Nicht verwenden**, außer zum Abgleich. |
| WRRL-Wasserkörper (UBA/WasserBLIcK/EEA WISE) | Berichtspflichtige Seen (> 50 ha) und Fließgewässer mit Zustand | Bund | [O] Lizenz prüfen | [O] | P2: Kandidat für Stufe-2-Merkmale (Seetyp, ökologischer Zustand). |

**Lizenzfolge ODbL:** Das erzeugte Gewässer-Datenpaket ist eine abgeleitete Datenbank und muss unter ODbL angeboten werden (Download-Link auf der Quellenseite). Die kartografische Darstellung ist ein „Produced Work" mit Attribution. Private Nutzerdaten werden nicht veröffentlicht und sind nicht betroffen [A; O: bei späterem Teilen von Angelstellen erneut prüfen].

**Spike S1 (M0) – zu messen:** Anzahl Objekte je Typ (Bremen → Hochrechnung DE), PMTiles-Größe z6–14, Suchindex-Größe, Laufzeit der Pipeline.

---

## 3. Tiefenkarten

### 3.1 Befund
Es gibt **keine** bundesweite, offen lizenzierte Quelle für Seentiefen in Deutschland, die ich verifizieren konnte. Die Lage ist zersplittert:

| Quelle | Abdeckung | Zugang/Lizenz | Bewertung |
|---|---|---|---|
| **Tiefenkarten der Seen M-V** (Landesamt für Innere Verwaltung / LM M-V) | Seen in M-V; Tiefenstufen, Tiefenlinien, Uferlinie; Echolot und dGPS, Vermessung 1993–2011 | Laut Metadaten: digitale Weitergabe an Dritte grundsätzlich nicht gestattet; Nutzung und Weiterverarbeitung über private Nutzung hinaus nur per **gesondertem Vertrag**. WMS vorhanden. [V: Suchergebnis aus Metadatensatz gdk.gdi-de.org 94e5ed55…; Originaldatensatz beim Abruf HTTP 503 → O: erneut prüfen] | **Kandidat per Vertrag.** Anfrage stellen (Kosten [O]). |
| Anglerverband Hamburg, Interaktive Angelkarte (ArcGIS) | Hamburger Verbandsgewässer, Tiefen und Angelzonen | Laut Altprojekt „ausschließlich für anglerische Zwecke, nicht für nautischen Gebrauch"; eine Lizenz für die Weiterverbreitung ist **nicht** dokumentiert [V: Kommentar in `tiefen.js` des Altprojekts] | **Nicht übernehmen ohne schriftliche Erlaubnis.** Anfrage an den Verband. |
| **Garmin Navionics Web API** | Weltweit inkl. vieler Binnenseen, HD-Tiefenlinien | Developer-Key über Formular. „Standard": kostenlos, Kartenfenster ohne eigene Overlays, muss für Endnutzer kostenlos sein. „Enhanced": jährliche Gebühr, eigene Overlays erlaubt [V: Suchergebnis developer.garmin.com/marine-charts]. Preise und Datennutzung [O] | **Kandidat.** Nur als separater „Tiefenmodus" (eigenes Kartenfenster) denkbar. Standard-Tarif verbietet eigene Overlays → Fänge nicht darüber darstellbar. Anfrage stellen. |
| Bayern (LfU), Baden-Württemberg (LUBW), Brandenburg (LfU/IfB), weitere Länder | Einzelne Seen vermessen [A] | Keine offene Quelle gefunden [V: Suche ohne Treffer am 2026-10-21] | [O] Je Landesamt anfragen; Liste in M9 abarbeiten. |
| WSV/BfG (Bundeswasserstraßen) | Peilungen schiffbarer Gewässer | [O] | P3, nur Flüsse/Kanäle. |
| OpenSeaMap (Wassertiefen-Projekt) | Crowdsourcing-Echolotdaten, lückenhaft | [O] Lizenz prüfen | Höchstens als „Community-Daten" mit klarer Kennzeichnung, nie als amtlich gemessen. |
| EMODnet Bathymetry | Meere | Offen | Nicht relevant für Binnengewässer. |
| swissBATHY3D (CH) | Schweizer Seen, frei, Quellenangabe Pflicht | – | Zeigt, dass es ein gutes Vorbild gibt; nicht relevant für DE (Bodensee ggf. teilweise [O]). |

### 3.2 Strategie
1. **MVP:** Kein Tiefen-Feature. Das Profil zeigt „Tiefenkarte: nicht verfügbar". Ein Feld `maxDepthM` wird nur aus belegter Quelle befüllt.
2. **Schnittstelle jetzt bauen** (`DepthProvider`, `DepthCoverage` je Gewässer, siehe DATA_MODEL §6), damit Anbieter später nur eingesteckt werden.
3. **Parallel anfragen** (du oder ich als Textentwurf): Garmin (Enhanced-Konditionen), LM M-V (Vertrag), Anglerverband Hamburg (Erlaubnis für die bereits bekannten Daten), 2–3 große Landesverbände.
4. Darstellung: eigener Modus mit eigener Farbskala, Legende mit Quelle und Messjahr, Banner „Nicht zur Navigation". Interpolierte Flächen werden nur gezeigt, wenn die Quelle sie selbst liefert. Die App interpoliert nicht selbst.
5. **Nutzergenerierte Tiefen** (z. B. Echolot-Import) sind **nicht** geplant. Falls später: getrennter Layer „eigene Lotungen", nie gemischt mit Quelldaten.

---

## 4. Fischarten je Gewässer

| Quelle | Inhalt | Lizenz | Bewertung |
|---|---|---|---|
| **GBIF: „Harmonised freshwater fish occurrence and abundance data for 12 federal states in Germany"** | 72 Süßwasserfischarten, 12 007 Probestellen aus WRRL-/FFH-Monitoring in BE, BB, HE, MV, NI, HB, NW, SL, ST, SN, SH, TH; 174 897 Nachweise; veröffentlicht 2026-06-22 | **CC BY 4.0** [V: api.gbif.org/v1/dataset/e0908eee-ad49-4e91-b4d0-1f05dd17b291] | **Kandidat Stufe 2 (P2).** Probestellen liegen überwiegend an Fließgewässern [A]. Zuordnung über Punkt-in-Polygon/Pufferabstand. Anzeige nur als „Nachweis bei Monitoring <Jahr>", **nicht** als Bestandsaussage. Fehlende Länder: BY, BW, RP, HH. |
| FischInfo NRW | Elektrobefischungen NRW | [O] keine Lizenzangabe gefunden | Über GBIF-Datensatz teilweise abgedeckt. |
| Länderberichte (z. B. Fischzustandsberichte) | Textuell | Urheberrecht | Nicht automatisiert verwendbar. |
| Angelportale (z. B. alleangeln.de) | Nutzerangaben zu Arten | Urheberrecht/AGB | **Nicht übernehmen.** Höchstens Link als „weiterführend" [O: ob gewünscht]. |

Artenliste (Namen, wiss. Namen) wird einmalig redaktionell aus der GBIF-Taxonomie erstellt (CC BY 4.0 bzw. GBIF Backbone [O]).

---

## 5. Recht (Fischereirecht der Länder)

### 5.1 Befund
- Es gibt **keine** maschinenlesbare, bundesweite Quelle für Schonzeiten und Mindestmaße [A, keine gefunden]. Rechtsgrundlage sind je Land Fischereigesetz und Fischereiverordnung bzw. Ausführungsverordnung.
- Amtliche Texte stehen in den Landesrechtsportalen. Gesetzestexte sind nach § 5 UrhG gemeinfrei; ihre Inhalte dürfen strukturiert wiedergegeben werden [A, O: bei Portalen auf Datenbankschutz der Aufbereitung achten → nur Inhalte, nicht Layouts übernehmen].
- Gewässerbezogene Regeln (Gewässerordnungen der Vereine, Pachtverträge) sind privatrechtlich, nicht zentral veröffentlicht und urheberrechtlich geschützt.

### 5.2 Quellenliste je Land (Einstiegspunkte, vor Erfassung zu verifizieren [O])

| Land | Portal | Bereits im Altprojekt geprüft |
|---|---|---|
| Baden-Württemberg | landesrecht-bw.de | – |
| Bayern | gesetze-bayern.de | – |
| Berlin | gesetze.berlin.de | – |
| Brandenburg | bravors.brandenburg.de | – |
| Bremen | transparenz.bremen.de | – |
| Hamburg | landesrecht-hamburg.de, dokumente.hamburg.de | HmbFAnG 2019, HmbFAnGDVO Stand 25.09.2023 (Prüfung 2026-10-21; landesrecht-hamburg.de damals nicht erreichbar) |
| Hessen | rv.hessenrecht.hessen.de | – |
| Mecklenburg-Vorpommern | landesrecht-mv.de | – |
| Niedersachsen | voris.wolterskluwer-online.de | – |
| **Nordrhein-Westfalen (zuerst, E7)** | recht.nrw.de | LFischVO, Fassung ab 03.07.2026 (Prüfung 2026-10-18) |
| Rheinland-Pfalz | landesrecht.rlp.de | – |
| Saarland | recht.saarland.de | – |
| Sachsen | revosax.sachsen.de | – |
| Sachsen-Anhalt | landesrecht.sachsen-anhalt.de | – |
| Schleswig-Holstein | gesetze-rechtsprechung.sh.juris.de | – |
| Thüringen | landesrecht.thueringen.de | – |

Die Altprojekt-Angaben (NRW, HH) gelten als **Ausgangspunkt**, nicht als geprüft für das neue Projekt. Sie werden in M7 erneut am amtlichen Text abgeglichen.

### 5.3 Pflege- und Aktualisierungsprozess
1. Jede Landesdatei `data/regulations/<land>.json` enthält `checkedAt`, `checkedBy`, `legalBasis[]` (Titel, Fassung, URL, Abrufdatum) und je Regel den **Paragrafen**.
2. CI-Check: Schema gültig; jede Regel hat eine Quelle; `checkedAt` älter als **180 Tage** erzeugt eine Warnung, älter als **365 Tage** einen Fehler (Build bleibt grün, aber ein Issue wird erzeugt [A]).
3. In der App: Banner „Zuletzt geprüft am … – möglicherweise veraltet", sobald 180 Tage überschritten sind. Status `partial` listet fehlende Teile.
4. Halbjährlicher Prüftermin (Kalendererinnerung für dich). Änderungen per Pull Request mit Link zur Fundstelle.
5. Disclaimer in jeder Rechtsansicht: „Keine Rechtsauskunft. Maßgeblich sind der amtliche Text und die Bedingungen deines Erlaubnisscheins."

---

## 6. Wetter

| Dienst | Kosten | Limits | Lizenz | Bewertung |
|---|---|---|---|---|
| **Open-Meteo** (Free) | 0 € | < 10 000 Aufrufe/Tag, 5 000/h, 600/min, 300 000/Monat; **nur nicht-kommerziell** [V: open-meteo.com/en/terms] | CC BY 4.0, Attribution [V] | **Gewählt** (E3 = nicht kommerziell). Forecast, Historical-Forecast und Archiv (ERA5) verfügbar (vom Altprojekt genutzt). Limits gelten pro IP, also pro Nutzergerät [V: „per IP address"]. |
| Open-Meteo (Abo) | [O] | höher | CC BY 4.0 | Bei kommerzieller Nutzung. |
| **Bright Sky** (DWD-Daten) | 0 € „for all purposes", kein Key [V: brightsky.dev] | Nicht angegeben [V] | DWD-Nutzungsbedingungen [V: Verweis], konkreter Lizenztext [O] | Kommerziell zulässige Alternative; nur DWD-Stationen und -Modelle für DE. |

Wetterwerte werden als **Modell- bzw. Stationswerte** gekennzeichnet („nicht am Gewässer gemessen"), wie im Altprojekt.

---

## 7. Hosting

| Option | Eignung | Offene Punkte |
|---|---|---|
| GitHub Pages | App-Shell, kleine Daten | Dateigrenze 100 MB im Repo; PMTiles-Range-Requests [O] |
| Cloudflare Pages + R2 | App + große PMTiles, Range-Requests | [O] aktuelle Freikontingente und Bedingungen prüfen |
| Netlify / Vercel | App-Shell | Große Binärdateien ungeeignet [A] |

---

## 8. Risiken, Kosten, Lizenzen – Übersicht

| Thema | Kosten (MVP) | Lizenzpflicht | Risiko |
|---|---|---|---|
| Basiskarte OpenFreeMap | 0 € | OSM-Attribution | Ausfall/Änderung ohne Vorwarnung |
| Gewässer aus OSM | 0 € + CI-Zeit | ODbL: Attribution + Share-Alike des Datenpakets | Datenqualität schwankt; IDs instabil (gelöst über Snapshot) |
| Hosting PMTiles | voraussichtlich 0–5 €/Monat [A] | – | Konditionen [O] |
| Wetter | 0 € (nicht kommerziell) | CC BY 4.0 | Wird bei Kommerzialisierung kostenpflichtig |
| Tiefenkarten | unbekannt [O] | Vertrag nötig | Ggf. kein Anbieter → Feature bleibt aus |
| Fischarten GBIF | 0 € | CC BY 4.0, Attribution je Datensatz | Fehlinterpretation als Bestand → klare Formulierung |
| Recht | redaktionelle Zeit | Gemeinfreie Gesetzestexte | Haftung bei Fehlern → Disclaimer, Prüfdatum, Quellenlink |
| Schriften (Inter, Fraunces) | 0 € | SIL OFL [A] | – |
| App-Name | 0 € (DPMA-Recherche) | Markenrecht | Kollision [O] |
| Altdaten HH (Tiefen/Zonen) | – | **Ungeklärt** | Unzulässige Weiterverbreitung → nicht übernehmen |

## 9. Offene Prüfungen (Checkliste)

- [ ] S1: Pipeline-Messung Bremen → Hochrechnung DE (M0)
- [ ] S2: OpenFreeMap-Styles und Performance auf Geräten (M0)
- [ ] Photon-Originalbedingungen (nur falls Fallback nötig)
- [ ] Hosting-Konditionen Cloudflare R2 / Range-Support GitHub Pages (vor M4)
- [ ] Metadatensatz M-V Tiefenkarten erneut abrufen; Vertragskonditionen anfragen (vor M9)
- [ ] Garmin Navionics Web API: Konditionen „Enhanced" anfragen (vor M9)
- [ ] Anglerverband Hamburg: Erlaubnis Tiefen/Zonen anfragen (vor M9)
- [ ] Lizenz WRRL-Wasserkörperdaten (vor P2)
- [x] ~~DWD-Lizenztext für Bright Sky~~ entfällt (E3 = nicht kommerziell)
- [ ] Je Bundesland Portal-URL und aktuelle Fassung (M7/M8)
- [ ] Markenrecherche App-Name (vor öffentlichem Release)
