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

**Spike S1 (M0) – durchgeführt am 2026-10-21 mit NRW statt Bremen**, Ergebnisse in §10.

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

**Erfassung 2026-10-22 (auf Wunsch vor NRW, Entwürfe zur Gegenprüfung):** Aus der Cloud-Umgebung erreichbar waren nur gesetze-bayern.de, voris.wolterskluwer-online.de, revosax.sachsen.de und dokumente.hamburg.de [V 2026-10-22]. Maschinell aus den Tabellen des amtlichen Texts gelesen, vom Nutzer am 2026-10-22 gegengeprüft, Status `partial`:
- **BY** AVBayFiG, Anlage (zu § 11), zuletzt geändert 10.04.2025 – https://www.gesetze-bayern.de/Content/Document/BayAVFiG/true
- **NI** BiFischO §§ 2–5 (Fassung ab 01.08.1989, VO zuletzt geändert 22.12.2005) – NI-VORIS. [O] Ob es neuere Änderungen gibt, die VORIS noch nicht zeigt, ist nicht geprüft.
- **SN** SächsFischVO vom 22.04.2022, Anlage (zu § 2), gültig ab 01.06.2022 – https://revosax.sachsen.de/vorschrift/19620
- **HH** HmbFAnGDVO, Gesamtausgabe Stand 25.09.2023 (letzte Änderung 01.02.2022) als PDF von hamburg.de. [O] Änderungen nach dem 25.09.2023 nicht geprüft (landesrecht-hamburg.de gesperrt).
- **BW** LFischVO § 1 (Gesamtausgabe Stand 22.10.2026, zuletzt geändert 10.02.2026), PDF-Export von landesrecht-bw.de, vom Nutzer bereitgestellt am 2026-10-22; Status `draft` bis zur Gegenprüfung.
- **BE** LFischO Anlage 1 (Gesamtausgabe Stand 22.10.2026, zuletzt geändert 27.10.2025), PDF-Export von gesetze.berlin.de, vom Nutzer bereitgestellt am 2026-10-22; Status `draft`.
- **HB** Bremisches Fischereigesetz (Fassung ab 30.06.2025, zuletzt geändert 02.09.2025), amtlicher PDF-Ausdruck von transparenz.bremen.de, vom Nutzer bereitgestellt am 2026-10-22: nur Fischereischein, Jugendliche, Erlaubnisschein, Stockangelrecht. Ergänzt um die **Bremische Binnenfischereiverordnung** vom 30.09.2011 (amtlicher PDF-Ausdruck, vom Nutzer am 2026-10-22): §§ 2–5, 7. Im amtlichen Text steht bei der Äsche „35 m"; als 35 cm übernommen und markiert. Eine Übersichtsseite des Fischeramts Bremen (fischeramtbremen.de, Stand 22.10.2026) liegt vor, wird aber nicht als Quelle genutzt, weil sie den Verordnungstext nur zusammenfasst.
- **MV** Landesfischereigesetz (Fassung 06.01.2025, zuletzt geändert 08.07.2026, Gesamtausgabe Stand 22.10.2026), PDF-Export von landesrecht-mv.de, vom Nutzer bereitgestellt am 2026-10-22: Fischereischein, Abgabe, Erlaubnis. Ergänzt um **Binnenfischereiverordnung** (Stand 22.10.2026, zuletzt geändert 27.01.2011) und **Küstenfischereiverordnung** (Stand 22.10.2026, zuletzt geändert 11.09.2026), PDF-Exporte vom Nutzer am 2026-10-22; Regeln je Geltungsbereich (Binnen-/Küstengewässer) getrennt. **[O]** Fisch- und Laichschonbezirke (§§ 11, 12 KüFVO) fehlen; die Übersicht des LALLF (lallf.de, Stand 22.10.2026) liegt vor, wird aber nicht als Quelle genutzt (keine Fundstellen, Fußnotenzeichen ohne Text).
- **RP** Landesfischereiordnung (zuletzt geändert 11.02.2026, Gesamtausgabe Stand 22.10.2026), Ausdruck von landesrecht.rlp.de, vom Nutzer bereitgestellt am 2026-10-22: Mindestmaße (§ 17), Artenschonzeiten und Fangverbote (§ 20), Frühjahrs-/Winterschonzeit nach Gewässern (§§ 18, 19, zusammengefasst). **[O]** Fischereischein (Landesfischereigesetz) fehlt.
- **SL** Landesfischereiordnung vom 05.02.2020, Erstveröffentlichung Amtsblatt Teil I Nr. 6 vom 27.02.2020 (PDF vom Nutzer): §§ 2, 4, 5, 6, 7, 8, 10, 11, 46. Abgeglichen mit der Gesamtausgabe Stand 22.10.2026 (zuletzt geändert 08.12.2021, PDF-Export von recht.saarland.de, vom Nutzer am 2026-10-22): alle verwendeten Paragrafen unverändert seit 28.02.2020 [V].
- **ST** Fischereiordnung (Gesamtausgabe Stand 22.10.2026, zuletzt geändert 06.03.2013), PDF-Export von landesrecht.sachsen-anhalt.de: §§ 2–5, 7. Krebse/Muscheln nur per Verweis auf das BNatSchG geschützt (nicht einzeln aufgezählt).
- **SH** Binnenfischereiverordnung (Gesamtausgabe Stand 22.10.2026, Anlage 1 neu gefasst 26.05.2021), PDF-Export von gesetze-rechtsprechung.sh.juris.de: Anlage 1, §§ 2, 5, 8. **[O]** Küstenfischereiverordnung und Anlage 3 (Winterschonzeit-Gewässer) fehlen.
- **TH** ThürFischAVO (Gesamtausgabe Stand 22.10.2026, zuletzt geändert 02.07.2024), Ausdruck von landesrecht.thueringen.de: § 1 Tabelle, §§ 6, 14, 16, 24.
Alle vier vom Nutzer am 2026-10-22 bereitgestellt.
BW, BE, HB, MV, RP, SL, ST, SH, TH: vom Nutzer am 2026-10-22 gegengeprüft, Status `partial`.
- **BB** Fischereiordnung (zuletzt geändert 24.08.2026), direkt von bravors.brandenburg.de abgerufen am 2026-10-22 [V]: Anlage (54 Zeilen), §§ 2, 2a Abs. 6, 3. Hecht/Zander der Erwerbsfischerei (Schonzeit nach Hegeplan) nur als Hinweis.
- **HE** Hessische Fischereiverordnung vom 14.04.2023, Verkündung GVBl. 2023 Nr. 15 (starweb.hessen.de, abgerufen am 2026-10-22) [V]: §§ 1, 2 (Entnahmefenster). **[O]** Spätere Änderungen nicht geprüft (rv.hessenrecht.hessen.de gesperrt) – Gesamtausgabe vom Nutzer erbeten.
Beide vom Nutzer am 2026-10-22 gegengeprüft, Status `partial`.
**Fischereischein-Regeln (2026-10-22, direkt abgerufen [V]):** BY (BayFiG Art. 26, 46–50, Fassung 23.12.2024; AVBayFiG §§ 2, 3, 9), NI (Nds. FischG §§ 57, 59, NI-VORIS), SN (SächsFischG §§ 19–22, Fassung 26.05.2012; SächsFischVO § 32), BB (BbgFischG §§ 13, 17–22, Fassung 23.04.2026), HH (HmbFAnG §§ 7, 9, 10, 12 aus HmbGVBl. Nr. 17/2019 – **[O]** spätere Änderungen nicht geprüft). Verdichtete Texte sind als „Zusammengefasst:" gekennzeichnet. Ergänzt aus Gesamtausgaben (PDF vom Nutzer, Stand 22.10.2026): BW (FischG §§ 31–37), SL (SFischG §§ 27–35), RP (LFischG §§ 33–41, neu gefasst 11.02.2026), HE (HFischG §§ 16, 29–35; HFischV § 27), BE (LFischG § 14 – Fischereischein steht im Landesfischereischeingesetz vom 21.04.1995 **[O]**), TH (ThürFischG §§ 14, 26–33), SH (LFischG §§ 14, 26–29), ST (FischG LSA §§ 26–31). HH: HmbFAnG-Gesamtausgabe Stand 22.10.2026 ohne Änderung seit 2019 [V]. **[O]** Abgabehöhen in TH, SH, ST, RP und Urlauberschein SH stehen in nicht vorliegenden Verordnungen.
Nicht erreichbar (Verbindungsabbruch bzw. 403/503): BB, HB, HE, MV, RP, SL, ST, SH, TH [V 2026-10-22]. Fischereischein-Regeln der Gesetze sind noch nicht erfasst (`missing`).

**Stand 2026-10-22, 01:22–01:30 UTC:** recht.nrw.de meldet „Dieser Server ist aktuell im Wartungsmodus!"; alle Unterseiten liefern 404 [V]. Die NRW-Inhalte werden erfasst, sobald der amtliche Text erreichbar ist. Zweitquellen (umwelt-online.de, lexaris.de) werden nicht als Quelle verwendet. Laut Suchergebnis wurde die LFischVO zuletzt durch Art. 2 der Verordnung vom 01.07.2026 geändert (gültig ab 03.07.2026) [O: am amtlichen Text bestätigen]. Viele Landesportale sind aus der Cloud-Umgebung nicht erreichbar (Verbindungsabbruch); die Links in der App (`STATE_PORTALS`) sind die Einstiegspunkte dieser Tabelle [O: je Land beim Erfassen prüfen].

Die Altprojekt-Angaben (NRW, HH) gelten als **Ausgangspunkt**, nicht als geprüft für das neue Projekt. Sie werden in M7 erneut am amtlichen Text abgeglichen.

### 5.3 Pflege- und Aktualisierungsprozess
1. Jede Landesdatei `app/data/regulations/<KÜRZEL>.json` (z. B. `NW.json`) enthält `checkedAt`, `checkedBy`, `legalBasis[]` (Titel, Fassung, URL, Abrufdatum) und je Regel den **Paragrafen**.
2. CI-Check (`pnpm validate:data`, auch Teil von `pnpm test`): Schema gültig; jede Regel hat Quelle und Paragraf, sonst rot. `checkedAt` älter als **180 Tage** erzeugt eine Warnung im Testlauf; ein automatisches Issue gibt es noch nicht [O].
3. In der App: Banner „Zuletzt geprüft am … – möglicherweise veraltet", sobald 180 Tage überschritten sind; ab 365 Tagen deutlicher Warnhinweis. Status `partial` listet fehlende Teile.
4. Erfassung immer zuerst als `draft`; sichtbar (`verified`/`partial`) erst nach Gegenprüfung durch dich am amtlichen Text (Entscheidung 2026-10-22).
5. Halbjährlicher Prüftermin (Kalendererinnerung für dich). Änderungen per Pull Request mit Link zur Fundstelle.
6. Disclaimer in jeder Rechtsansicht: „Keine Rechtsauskunft. Maßgeblich sind der amtliche Text und die Bedingungen deines Erlaubnisscheins."

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

- [x] S1: Pipeline-Messung (NRW) → Hochrechnung DE, siehe §10.1
- [x] S1b: Deutschland-Lauf, Hochrechnung bestätigt (157 MB), siehe §10.4
- [x] S2: OpenFreeMap-Styles headless gemessen, siehe §10.2
- [ ] S2b: Test auf echten Geräten (Checkliste `tools/map-spike/README.md`, durch dich)
- [ ] Photon-Originalbedingungen (nur falls Fallback nötig)
- [x] Range-Support GitHub Pages [V 2026-10-21]; Hosting über Release + Pages (ARCHITECTURE §6.1a)
- [x] GitHub Pages liefert `water.pmtiles` (164,7 MB) aus, Range-Abrufe am Anfang und Ende mit HTTP 206 [V 2026-10-21, Live-Test inkl. Suche „Bodensee" und Profil]
- [ ] Metadatensatz M-V Tiefenkarten erneut abrufen; Vertragskonditionen anfragen (vor M9)
- [ ] Garmin Navionics Web API: Konditionen „Enhanced" anfragen (vor M9)
- [ ] Anglerverband Hamburg: Erlaubnis Tiefen/Zonen anfragen (vor M9)
- [ ] Lizenz WRRL-Wasserkörperdaten (vor P2)
- [x] ~~DWD-Lizenztext für Bright Sky~~ entfällt (E3 = nicht kommerziell)
- [ ] Je Bundesland Portal-URL und aktuelle Fassung (M7/M8)
- [ ] Markenrecherche App-Name (vor öffentlichem Release)

---

## 10. Messergebnisse M0 (2026-10-21)

### 10.1 Spike S1 – Gewässer-Pipeline mit NRW

Eingabe: `nordrhein_westfalen-latest.osm.pbf` von download.openstreetmap.fr, 1 110 678 265 Byte, MD5 geprüft, Datenstand 2026-10-21 [V]. Werkzeuge: osmium-tool 1.16.0, tippecanoe 2.49.0 [V]. Code: `tools/water-pipeline`.

| Messgröße | NRW [V] | Hochrechnung Deutschland [A] |
|---|---|---|
| Laufzeit gesamt (Filtern → Kacheln → Prüfung) | 137 s | ca. 10–25 min |
| Gewässerobjekte gesamt | 163 294 | ca. 0,7–1,7 Mio. |
| davon Flächen | 63 134 | |
| davon Linien (Flüsse, Kanäle, benannte Bäche) | 100 161 | |
| Flächen ohne Namen | 60 354 (95,6 %) | |
| Flächen ohne `water=*` (Typ unbekannt) | 30 414 (48 %) | |
| Flächen < 0,1 ha | 44 327 (70 %) | |
| Median Fläche | 0,04 ha | |
| ausgeschlossen (Klärbecken, Rückhaltebecken u. a.) | 10 931 | |
| Splitter-Geometrien < 1 m² / < 2 m (verworfen) | 309 | |
| **`water.pmtiles` (z8–14)** | **20,9 MB** | **ca. 85–220 MB** |
| größte Kachel z8 / z14 | 31 KB / 5 KB | ähnlich |
| Suchindex (18 548 Einträge inkl. 5 371 Orte) | 1,5 MB roh, **0,5 MB gzip**, 260 Shards, größter Shard 34 KB gzip | ca. 2–5 MB gzip; Shards auf 3 Zeichen verfeinern |
| Gewässer-Metadaten (`waters.ndjson`) | 31,7 MB roh, 5,6 MB gzip | ca. 22–58 MB gzip → **muss nach Kachel geteilt werden** |
| Zuordnung Kreis/kreisfreie Stadt | 94,4 % | |
| Zuordnung Gemeinde | 81,8 % | |

**Hochrechnung:** Faktor 4 (Datenvolumen: Deutschland-PBF ≈ 4,5 GB bei Geofabrik gegenüber 1,1 GB NRW) bis Faktor 10,5 (Fläche: 357 592 km² gegenüber 34 112 km²). Nordostdeutschland ist seenreicher als NRW, der obere Wert ist deshalb plausibel. Die Hochrechnung ist eine Annahme, bis S1b sie mit einem vollen Lauf bestätigt.

**Befunde und Folgen:**
1. **Bug in tippecanoe 2.49:** Die Feature-Eigenschaft `tippecanoe.minzoom` lässt überlappende Nachbarobjekte verschwinden. Reproduziert mit genau 2 Objekten (De Wittsee + angrenzender Teich). Der See fehlte in allen Zoomstufen. Lösung: Attribut `mz` plus Filter `-j` beim Kacheln plus Stilfilter. **`run.sh` prüft seitdem, dass jedes Objekt in den z14-Kacheln steht, und bricht sonst ab.**
2. osmium vergibt für Flächen eigene IDs (`a` = 2·Way-ID bzw. 2·Relation-ID+1). Die Pipeline rechnet sie in OSM-IDs zurück. Gegenprobe: De Wittsee = `osm:w35044256`, Kleiner De Wittsee = `osm:w27634541`, identisch mit den OSM-Referenzen der Alt-App [V].
3. Fast die Hälfte der Wasserflächen hat in OSM keinen Typ. Das Profil muss „Gewässer (Typ unbekannt)" sauber darstellen; nichts wird geraten.
4. 95 % der Flächen sind unbenannt. Die Suche findet deshalb nur einen kleinen Teil (benannte Gewässer und Orte). Unbenannte Teiche erreicht man nur über die Karte.
5. Kreisfreie Städte haben in OSM keine Gemeindeebene (admin_level 8). Die Anzeige nutzt dann die Kreisebene.
6. Ein Fluss verläuft oft als Linie durch einen See (z. B. Nette durch den De Wittsee). Regel für den Tipp: Die Fläche unter dem Finger hat Vorrang, Linien gelten nur im 12-px-Umkreis.
7. Mit 85–220 MB passt die Deutschland-Datei nicht zu GitHub Pages (100 MB pro Datei). Das bestätigt E4: ab M4 Cloudflare R2, alternativ eine Datei pro Bundesland.

### 10.2 Spike S2 – OpenFreeMap in MapLibre (headless)

Aufbau: MapLibre GL JS 6.15.0 (BSD-3-Clause) und pmtiles 4.5.0 (BSD-3-Clause) [V: package.json]. Gemessen mit Chromium headless, 390 × 844 px, DPR 3, Touch, 4-fache CPU-Drosselung, Software-WebGL, leerer Cache. Code: `tools/map-spike`.

| Stil | Ansicht | bis Karte fertig | Datenmenge Basiskarte |
|---|---|---|---|
| liberty | Deutschland z5,3 | 4,5 s | 2,9 MB |
| liberty | Köln z11 | 2,9 s | 0,7 MB |
| liberty | De Wittsee z14 | 2,9 s | 0,4 MB |
| positron | Deutschland / Köln / De Wittsee | 2,9 / 2,5 / 2,7 s | 1,8 / 0,7 / 0,4 MB |
| dark | Deutschland / Köln / De Wittsee | 2,6 / 2,3 / 2,0 s | 1,5 / 0,6 / 0,3 MB |
| liberty + Gewässer-Overlay | Köln / De Wittsee | 3,0 / 3,1 s | + 34 / 32 KB Overlay |

- Verfügbare Stile: `liberty`, `positron`, `bright`, `dark`, `fiord` (jeweils HTTP 200) [V]. Kacheldaten-Stand laut TileJSON: `planet/20261018_080001_pt`, also 3 Tage alt; maxzoom 14 [V].
- Attribution kommt automatisch: „OpenFreeMap © OpenMapTiles Data from OpenStreetMap" [V].
- Keine JavaScript-Fehler. `liberty` erzeugt harmlose Stilwarnungen (Autobahnschilder-Filter).
- Bildraten beim Verschieben (5–13 fps) entstehen durch Software-WebGL und **sind keine Aussage über echte Geräte** → S2b.
- Tipp-Test: Seemitte → „De Wittsee · See"; Feld → „Kein Gewässer"; Fluss nördlich → „Nette · Fluss" [V]. Die Attributionsleiste verdeckt unten antippbare Fläche → in M3 kompakte Attribution verwenden.
- **Nach Gerätetest S2b (2026-10-21):** `positron` war zu grau, `dark` zu dunkel, `fiord` gefiel ebenfalls nicht. **Jetzt beide Themes auf `liberty`**; im dunklen Theme färbt die App die Ebenen selbst um (petrolgrünes Land, sattblaues Wasser, dezente Straßen; Farben in `app/src/adapters/openfreemap.ts`). Vorlage war ein Kartenbild des Nutzers als Farbreferenz; übernommen wurden keine Daten oder Stildateien.
- **Umgesetzt in M3 (überholt):** `positron`/`dark`; die Stile beschriften standardmäßig international/englisch, die App stellt auf `name:de` um [V: Bildvergleich 2026-10-21].
- **Empfehlung für M3 (ursprünglich):** `positron` (hell) und `dark` (dunkel) als Basis. Sie sind ruhiger und leichter als `liberty`, und das eigene Gewässer-Overlay hebt sich besser ab. Die endgültige Wahl folgt nach S2b auf deinen Geräten.

### 10.3 Umgebung
- `download.geofabrik.de` wird in der Cloud-Umgebung von der Netzwerkrichtlinie gesperrt (Verbindungsabbruch) [V]. Ausweichquelle `download.openstreetmap.fr` bietet nur NRW und dessen Regierungsbezirke [V]. Für S1b genutzt: `download.openstreetmap.fr/extracts/europe/germany.osm.pbf` (Deutschland gesamt, mit `.md5`) [V 2026-10-21]. `overpass-api.de` ist in der Cloud-Umgebung ebenfalls gesperrt [V]; der Datenlauf läuft deshalb in GitHub Actions (§10.4).

### 10.4 S1b – Deutschland-Lauf (2026-10-21)

Eingabe: `germany.osm.pbf` von download.openstreetmap.fr (`/extracts/europe/`), 5 911 927 632 Byte, MD5 geprüft, Datenstand 2026-10-21T02:06:20Z [V]. Werkzeuge: osmium-tool 1.16.0, **tippecanoe 2.79.0** (aus dem Quellcode) [V].

| Messgröße | Deutschland [V] | Hochrechnung aus S1 [A] |
|---|---|---|
| Laufzeit gesamt (Cloud-Umgebung, 8 Kerne) | 27 min | 10–25 min |
| Gewässerobjekte | 895 043 (Flächen 424 053, Linien 470 990), inkl. 41 Grenzgewässer | 0,7–1,7 Mio. |
| `water.pmtiles` (z8–14) | **157 MB** | 85–220 MB |
| Suchindex | 135 500 Einträge, 4,6 MB gzip, 466 Shards, größter 188 KB gzip | 2–5 MB gzip |
| Zuordnung Land / Kreis / Gemeinde | 98,0 % / 97,3 % / 91,0 % | |
| Stichprobe WAT-2 (20 Gewässer) | **20/20** im Release-Lauf (vorher 19/20, Bodensee fehlte, siehe unten) | |
| Veröffentlicht | Release `wasserdaten-2026-10-21-5`: `wasserdaten.tar.gz` 160,5 MB; `water.pmtiles` 164,7 MB [V] | |

**Befunde und Folgen:**
1. **tippecanoe 2.49 (Ubuntu-Paket) ist für diese Datenmenge unbrauchbar.** Der erste Lauf verlor 30 Objekte, und 61 Kachelobjekte trugen die `wid` eines anderen Gewässers (Beispiel: Abschnitte des Drakesbachs in Thüringen mit der ID eines Moritzbachs in Zwickau). Ursachen laut Changelog [V: github.com/felt/tippecanoe CHANGELOG.md, 2026-10-21]: „Fix accidental loss … of features that specify an explicit minzoom" (2.52.0) und „Fix hash collisions in the string pool" (2.55.0). `run.sh` verlangt jetzt ≥ 2.55; Schritt 5 (`src/verify.ts`) vergleicht jedes Objekt der z14-Kacheln mit seiner Eingabe (Vorhandensein **und** Eigenschaften).
2. Kleinstflächen wurden bei z14 zusammengefasst (`tiny polygon reduction`); jetzt `--no-tiny-polygon-reduction-at-maximum-zoom`. Streifen mit mittlerer Breite < 0,5 m gelten als Splitter.
3. **Grenzgewässer:** 41 Gewässer-Relationen reichen über den Auszug hinaus (u. a. Bodensee, Stettiner Haff, Sauer) und fielen ganz weg. Entscheidung des Nutzers (2026-10-21, Option A): Schritt 1b lädt genau diese Relationen **beim Bauen** mit einer einzigen Overpass-Abfrage vollständig nach (gleiche Daten und Lizenz, ODbL). Nicht zur Laufzeit der App. Die OSM-Editier-API scheidet aus, da sie laut Nutzungsrichtlinie nicht für Lesezugriffe gedacht ist [V: operations.osmfoundation.org/policies/api, 2026-10-21]. Das Manifest vermerkt die Ergänzung (`source.supplement`).
4. Overpass ist aus der Cloud-Entwicklungsumgebung gesperrt [V]. Der Datenlauf läuft deshalb in GitHub Actions (`.github/workflows/wasserdaten.yml`) und veröffentlicht das Ergebnis als Release `wasserdaten-*`. Erfahrungen am 2026-10-21 [V]: `download.geofabrik.de` antwortete GitHub Actions mit 404, `download.openstreetmap.fr` zeitweise gar nicht oder langsam; `overpass-api.de` war in einem Lauf nicht erreichbar, im nächsten schon. Deshalb Ersatzquellen und Abbruch bei hängendem Download.
5. Suche: OSM-Zusatznamen (`name:de`, `alt_name`, `official_name`) werden indiziert (Möhnetalsperre ↔ Möhnesee); ein Klammerzusatz („Schweriner See (Außensee)") zählt als genauer Treffer.
