# Release-Checkliste iPhone-App (App Store)

Stand 2026-11-23 (zuerst 2026-11-06, Phase 5, Masterprompt „Vorbereitung auf einen späteren Release“). Ergänzt `IOS_PLAN.md`.
Kennzeichnung: ✅ erledigt · 🔲 offen · **[V]** verifiziert · **[A]** Annahme · **[O]** offen.
Eingereicht wird nur durch den Nutzer; TestFlight-Bauten nur auf ausdrücklichen Wunsch.

## A. Pflicht nach Apples Regeln (Inhalte zwischen Nutzern, Regel 1.2 / 5.1.1)

| Punkt | Stand |
|---|---|
| Konto in der App löschbar (Mehr → Konto → Konto löschen, entfernt auch Fotos und Profilbild) | ✅ |
| Melden von Beiträgen, Kommentaren, Spots und Konten | ✅ (`SafetyMenu`) |
| Blockieren, Liste „Blockiert“ zum Aufheben | ✅ |
| Regeln der Community vor der Anmeldung bestätigen (Nutzungsbedingungen für Inhalte) | ✅ (`/mehr/regeln`) |
| Bearbeitung von Meldungen binnen 24 h, Moderationsbereich, Sperren mit Mail | ✅ (`MODERATION_PLAN.md`) |
| Kontaktadresse für Meldungen | ✅ moderation@fangpunkt.com |
| „Mit Apple anmelden“ | nicht nötig – keine Anmeldung über Dritte (nur E-Mail und Passwort, seit 2026-11-10) [A] |
| **Anmeldung mit Passwort**: Supabase-Einstellungen und Mailvorlagen nach `supabase/AUTH_EINRICHTUNG.md` (Bestätigung an, 10 min, Mindestlänge 10, Sicherheits-Mails), Function `password-notice` einspielen, danach Hinweis-Mail aus der Moderation; Website-AASA mit `webcredentials` | Nutzer, Claude | ✅ 2026-11-24 vom Nutzer bestätigt: Supabase-Einstellungen (Abschnitt 1–4), `password-notice` eingespielt, 0 Konten ohne Passwort (Hinweis-Mail nicht nötig), AASA mit `webcredentials` auf der Website |

## B. Technik

| Punkt | Wer | Stand |
|---|---|---|
| Bau und Upload über GitHub Actions (`ios.yml`) | – | ✅ erste Version 2026-11-03 [V], zweite 2026-11-10 mit Paketen 7–12 und Hintergrund-Route [V] |
| Push-Mitteilungen (Server, Function `send-push`, APNs-Secrets) | Nutzer prüft am iPhone | ✅ am iPhone bestätigt 2026-11-23: Mitteilung „Neue Meldung“ für Moderatoren kommt an (Sperrbildschirm und Pop-up) |
| Haptik, Tastatur, „wie eine echte App“ | Nutzer prüft am iPhone | 🔲 auf dem Gerät ungeprüft [O] |
| **Dateien speichern in der App** (Sicherung, CSV, Kalenderdatei) über das Teilen-Menü (Web Share, ohne neue Abhängigkeit, Paket 10) | Claude, Nutzer prüft am iPhone | ✅ gebaut, 🔲 am iPhone prüfen; falls es dort nicht klappt: `@capacitor/share` + `filesystem` |
| Erinnerungen vor Angelterminen (`@capacitor/local-notifications`) | Claude | 🔲 gewünscht (Nutzer 2026-11-02), hilft gegen Ablehnung nach Regel 4.2 |
| Hintergrund-Route bei Sessions (Wunsch Nutzer 2026-11-03, Weg B 2026-11-10) | Claude, Nutzer prüft am iPhone | ✅ gebaut (eigenes Swift-Modul, nur „Beim Verwenden“), ✅ übersetzt im TestFlight-Bau 2026-11-10 [V]; 🔲 am iPhone prüfen (Sperrbildschirm, blaue Anzeige, Akku); Zweck im Prüfhinweis an Apple nennen |
| Standort fragt nur einmal um Erlaubnis (Wunsch Nutzer 2026-11-19, eigenes Swift-Modul `LocationPlugin`, ersetzt `navigator.geolocation` in der App) | Claude, Nutzer prüft am iPhone | ✅ gebaut (Port, Adapter, Tests); 🔲 Bau in `ios.yml` abwarten; 🔲 am iPhone prüfen: App löschen und neu installieren → genau eine Abfrage „Beim Verwenden der App“, danach beim Start, bei Wetter und in den Privatsphäre-Einstellungen keine weitere |
| Angelpapiere mit Erinnerung (Wunsch Nutzer 2026-11-16) | Claude, Nutzer prüft am iPhone | ✅ gebaut (Wallet, Sicherung, eigenes Swift-Modul `RemindersPlugin` für lokale Mitteilungen, ohne neue Abhängigkeit); 🔲 Bau in `ios.yml` abwarten (Swift, neue Datei im Projekt); 🔲 am iPhone prüfen: Papier mit Ablaufdatum in 2 Tagen anlegen → Systemabfrage für Mitteilungen erscheint, Erinnerung kommt um 9 Uhr; Verlängern plant neu; Mitteilungen in den iPhone-Einstellungen aus → Hinweis auf der Seite |
| Live Activity auf dem Sperrbildschirm (Wunsch Nutzer 2026-11-15) | Claude, Nutzer prüft am iPhone | ✅ gebaut (Widget-Erweiterung `FangpunktLive`, Plugin, Einstellungen, Tests der Regeln); ✅ Bau 2026-11-15 grün; ⚠ Sperrbildschirm war zu hoch (iOS schneidet bei etwa 160 pt ab) → kompakter gesetzt (Kopfzeile mit Titel, Status und Zeit; Kennzahlen und Knöpfe niedriger), 🔲 neuer Bau am iPhone prüfen; 🔲 am iPhone prüfen: Start mit der Session, Zeit läuft, Pause/Weiter/Fang-Knopf öffnen die App, Ende mit Zusammenfassung, Dynamic Island, Einstellung „Live Activity“ und „Gewässername“; ab iOS 17: Pause/Weiter/Beenden ohne App-Öffnen (Anzeige sofort, Session stimmt nach kurzer Zeit bzw. beim Öffnen) |
| Gemeinsame Session: Pause/Weiter/Ende melden, Sperrbildschirm-Knöpfe im Hintergrund (Wunsch Nutzer 2026-11-21) | Claude, Nutzer prüft am iPhone | ✅ gebaut, im TestFlight-Bau 2026-11-23; 🔲 am iPhone prüfen: Mitteilung gedrückt halten → Annehmen/Ablehnen ohne die App zu öffnen; bei beendeter App wird beim nächsten Öffnen angewendet |
| **Cloud-Sicherung** (Server, Logik, Dienst, Oberfläche; Entscheidung Nutzer 2026-11-23) | Claude, Nutzer prüft am iPhone | ✅ gebaut, im TestFlight-Bau 2026-11-23 [V]; SQL `*_cloud_backup.sql` eingespielt; 🔲 am iPhone prüfen: Zustimmungsfenster erscheint einmal, Sicherung läuft (Mehr → Daten & Sicherung zeigt Stand und Verbrauch), Fotos erscheinen in Supabase unter Storage → `backups`, „Aus der Cloud wiederherstellen“ auf einem frischen Gerät, „Cloud-Sicherung löschen“; 🔲 **Supabase auf Pro vor dem Livegang** (Free: 1 GB, Pause nach einer Woche) |
| Feed-Fotos in mittlerer Größe (1080 px) | Claude | ✅ gebaut (PR #222); Einsparung nur geschätzt, nicht gemessen |
| Moderatoren-Pop-up für neue Meldungen (Band, Vollbild nach 20 h, Mitteilung) | Nutzer | ✅ am iPhone bestätigt 2026-11-23 |
| **Universal Links** (geteilte Profile öffnen die App): „Associated Domains“ für `com.fangpunkt.app`, Team-ID in `apple-app-site-association` der Website | Nutzer (Apple-Konto), Claude | ✅ Datei 2026-11-24 geprüft [V]: Team-ID `8QS58CR3VS`, `applinks` + `webcredentials`, ohne Weiterleitung, Apples CDN liefert sie aus (Inhaltstyp `application/octet-stream` von GitHub Pages ist unkritisch); TestFlight-Bauten mit dem Eintrag laufen durch; 🔲 am iPhone prüfen: Profil-Link antippen öffnet die App |
| Kamera/Fotoauswahl nativ (`@capacitor/camera`) | Claude | 🔲 optional – `<input type=file>` öffnet Kamera/Fotos schon |
| Datenschutz-Manifest (`PrivacyInfo.xcprivacy`): Capacitor bringt eigene mit; ob die App selbst eines braucht, zeigt Apples Rückmeldung beim Upload | Claude | 🔲 [A] Upload-Mail prüfen |
| Versionsnummer je Einreichung erhöhen | Claude | 🔲 vor dem Einreichen |
| Volle Testläufe grün (Unit, E2E ohne Wiederholung) | Claude | ✅ 2026-11-06 (540 / 258) |
| Sicherheitsprüfung Server (RLS, Rechte, keine Geheimnisse im Repo) | Claude | ✅ 2026-11-06 |

## C. Store-Eintrag (App Store Connect)

| Punkt | Wer | Stand |
|---|---|---|
| App angelegt, Bundle-ID `com.fangpunkt.app` | Nutzer | ✅ |
| Datenschutzerklärung als öffentliche Seite | – | ✅ fangpunkt.com/datenschutz (laufend ergänzt) |
| Support-/Kontaktseite | – | ✅ fangpunkt.com/kontakt |
| **App-Datenschutzangaben** neu ausfüllen (die Liste in `IOS_PLAN.md` §5 ist veraltet: seit dem Konto gibt es Daten zwischen Nutzern, seit der Cloud-Sicherung auch Fangbuch, Orte, Routen und Fotos auf dem Server) – Entwurf in Abschnitt E, **2026-11-23 um die Cloud-Sicherung ergänzt** | Nutzer, Claude bereitet vor | 🔲 |
| **Datenschutzerklärung der Website** (`fangpunkt.com/datenschutz`) um die Cloud-Sicherung ergänzen (Text wie `PrivacyPage`, Abschnitt Supabase) | Claude Entwurf, Nutzer (Repo `fangpunkt_webside`) | 🔲 |
| Altersfreigabe: Fragebogen mit „Inhalte von Nutzern“ (Beiträge, Kommentare) → voraussichtlich höhere Stufe [A] | Nutzer | 🔲 |
| Beschreibung, Untertitel, Stichworte (nur vorhandene Funktionen, keine Tiefen-/Offline-Karten) | Claude Entwurf, Nutzer prüft | 🔲 |
| Screenshots (vom iPhone des Nutzers, mit Beispieldaten) | Nutzer | 🔲 |
| Prüfhinweis an Apple: Zweck, Konto freiwillig, Test-Zugang für den Prüfer (E-Mail + Passwort eines Testkontos), Standort/Kamera, Moderation, „keine Rechtsauskunft“ | Claude Entwurf | 🔲 **Test-Zugang**: Testkonto mit Passwort anlegen und im Prüfhinweis angeben |
| Händlerstatus (EU/DSA): kostenlos, ohne Werbung → „kein Händler“ | Nutzer | 🔲 [A] |
| Name „Fangpunkt“ im App Store frei / Markenlage | Nutzer | 🔲 [O] |

## D. Inhalte, die vor dem Einreichen gegengeprüft sein sollten

- Knoten, Montagen, Köderführung: vom Nutzer gegengeprüft (2026-11-23). ✅
- Rechtsdaten: alle 16 Länder `partial` mit Liste der Lücken (Stand 2026-11-23: Abgabehöhen und Gebühren aller Länder erfasst; offen u. a. Gebührenrechtsgrundlage BE/NW, Küste, Behördenanordnungen – siehe `CLAUDE.md`), nächste Prüfung ab März 2027 (Workflow „Rechtsdaten prüfen“). Neue Einträge sind noch nicht vom Nutzer gegengeprüft.
- Store-Texte und Screenshots dürfen nur zeigen, was es gibt („Offline verfügbar“ nur mit Testbeleg).

## E. Entwurf App-Datenschutzangaben (zum Übertragen, vor Abgabe gemeinsam prüfen)

Kein Tracking (keine Weitergabe an Werbenetzwerke, keine Verknüpfung mit fremden Daten).

| Datenart (Apple) | Wofür | Mit Person verknüpft | Wann |
|---|---|---|---|
| Kontaktdaten – E-Mail-Adresse | App-Funktion (Anmeldung) | ja | nur mit Konto |
| Nutzerinhalte – Fotos | App-Funktion (geteilte Beiträge, Profilbild) | ja | nur was man teilt |
| Nutzerinhalte – andere (Text, Kommentare, Fischart/Länge, Profiltext und -angaben für Freunde) | App-Funktion | ja | nur was man teilt bzw. mit Konto angibt |
| Standort – genau | App-Funktion (geteilte Spots) | ja | nur wenn man einen Spot teilt |
| Standort – ungefähr | App-Funktion (Wetter, gerundet) | nein | Wetter an |
| Kennungen – Nutzer-ID | App-Funktion (Konto) | ja | nur mit Konto |
| Kennungen – Gerät (Push-Token) | App-Funktion (Mitteilungen) | ja | nur wenn erlaubt |
| Nutzungsdaten – Interaktion (GoatCounter, nur Bereichspfade) | Analyse | nein | abschaltbar |
| Sonstige – Meldungen an die Moderation | App-Funktion (Sicherheit) | ja | nur beim Melden |

**Mit der Cloud-Sicherung (seit 2026-11-23, nur nach ausdrücklicher Zustimmung, jederzeit ausschaltbar und löschbar)** kommen hinzu bzw. ändern sich diese Zeilen:

| Datenart (Apple) | Wofür | Mit Person verknüpft | Wann |
|---|---|---|---|
| Nutzerinhalte – Fotos (auch nicht geteilte Fangfotos) | App-Funktion (Sicherung und Wiederherstellung) | ja | nur nach Zustimmung zur Cloud-Sicherung |
| Nutzerinhalte – andere (Fänge, Sessions, Termine, Köder-Favoriten, Angelpapiere) | App-Funktion (Sicherung) | ja | nur nach Zustimmung |
| Standort – genau (Orte und GPS-Routen der Sessions) | App-Funktion (Sicherung) | ja | nur nach Zustimmung |

Alle drei sind nur für die Person selbst lesbar (auch Moderatoren nicht), bis 500 MB je Person. Ohne Zustimmung bleiben Fangbuch, Routen (auch die Hintergrund-Aufzeichnung der iPhone-App), nicht geteilte Orte und Fotos auf dem Gerät → „nicht erfasst“. **Offen:** Ob Apple die Zeilen als „optional“ zulässt oder wegen des Standard-an-mit-Zustimmung-Fensters als „erfasst“ verlangt, entscheidet die Angabe beim Ausfüllen; im Zweifel „erfasst“ angeben. Die Zustimmungstexte (Standort, Fotos) sollte jemand mit Datenschutzkenntnis prüfen.

## F. Vor dem Livegang (Stand 2026-11-23)

| Punkt | Wer | Stand |
|---|---|---|
| **Supabase auf Pro** (Free pausiert nach einer Woche ohne Aktivität, 1 GB Speicher; Pro: 25 $/Monat, 100 GB Dateien, 8 GB Datenbank, tägliche Sicherung 7 Tage) – Entscheidung Nutzer 2026-11-23: ab Livegang | Nutzer | 🔲 |
| Zustellung der Mails: **DKIM** bei INWX bzw. Wechsel zu Brevo (sonst Spam bei Bestätigungs- und Passwort-Mails) | Nutzer | 🔲 [O] |
| Universal Links: Associated Domains im Apple-Konto, Team-ID in der AASA | Nutzer | ✅ Datei in Ordnung; 🔲 Test am iPhone (siehe Abschnitt B) |
| iPhone-Prüfliste aus Abschnitt B durchgehen (neuer TestFlight-Bau 2026-11-23, Run 45228780290) | Nutzer | 🔲 |
| Store-Texte, Prüfhinweis mit Testkonto, Versionsnummer erhöhen | Claude Entwurf | 🔲 |
| Apple-Vorgabe: ab April 2027 Bau mit iOS-27-SDK (Xcode 27) – `ios.yml` rechtzeitig anpassen | Claude | 🔲 vor April 2027 |
| Browser-Test SUG-1 („Angler entdecken“) war rot: Testfehler (Playwright scrollte beim Klick auf die halb sichtbare Karte), App unverändert | Claude | ✅ repariert in PR 230 |
| Impressum und Nutzungsbedingungen auf der Website; rechtliche Prüfung der Zustimmungstexte | Nutzer | 🔲 |
