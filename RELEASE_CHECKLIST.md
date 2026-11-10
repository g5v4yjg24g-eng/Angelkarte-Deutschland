# Release-Checkliste iPhone-App (App Store)

Stand 2026-11-06 (Phase 5, Masterprompt „Vorbereitung auf einen späteren Release“). Ergänzt `IOS_PLAN.md`.
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
| „Mit Apple anmelden“ | nicht nötig – keine Anmeldung über Dritte (nur E-Mail-Code) [A] |

## B. Technik

| Punkt | Wer | Stand |
|---|---|---|
| Bau und Upload über GitHub Actions (`ios.yml`) | – | ✅ erste Version 2026-11-03 [V], zweite 2026-11-10 mit Paketen 7–12 und Hintergrund-Route [V] |
| Push-Mitteilungen (Server, Function `send-push`, APNs-Secrets) | Nutzer prüft am iPhone | 🔲 auf dem Gerät ungeprüft [O] |
| Haptik, Tastatur, „wie eine echte App“ | Nutzer prüft am iPhone | 🔲 auf dem Gerät ungeprüft [O] |
| **Dateien speichern in der App** (Sicherung, CSV, Kalenderdatei) über das Teilen-Menü (Web Share, ohne neue Abhängigkeit, Paket 10) | Claude, Nutzer prüft am iPhone | ✅ gebaut, 🔲 am iPhone prüfen; falls es dort nicht klappt: `@capacitor/share` + `filesystem` |
| Erinnerungen vor Angelterminen (`@capacitor/local-notifications`) | Claude | 🔲 gewünscht (Nutzer 2026-11-02), hilft gegen Ablehnung nach Regel 4.2 |
| Hintergrund-Route bei Sessions (Wunsch Nutzer 2026-11-03, Weg B 2026-11-10) | Claude, Nutzer prüft am iPhone | ✅ gebaut (eigenes Swift-Modul, nur „Beim Verwenden“), ✅ übersetzt im TestFlight-Bau 2026-11-10 [V]; 🔲 am iPhone prüfen (Sperrbildschirm, blaue Anzeige, Akku); Zweck im Prüfhinweis an Apple nennen |
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
| **App-Datenschutzangaben** neu ausfüllen (die Liste in `IOS_PLAN.md` §5 ist veraltet: seit dem Konto gibt es Daten zwischen Nutzern) – Entwurf in Abschnitt E | Nutzer, Claude bereitet vor | 🔲 |
| Altersfreigabe: Fragebogen mit „Inhalte von Nutzern“ (Beiträge, Kommentare) → voraussichtlich höhere Stufe [A] | Nutzer | 🔲 |
| Beschreibung, Untertitel, Stichworte (nur vorhandene Funktionen, keine Tiefen-/Offline-Karten) | Claude Entwurf, Nutzer prüft | 🔲 |
| Screenshots (vom iPhone des Nutzers, mit Beispieldaten) | Nutzer | 🔲 |
| Prüfhinweis an Apple: Zweck, Konto freiwillig, Test-Zugang für den Prüfer (E-Mail-Code!), Standort/Kamera, Moderation, „keine Rechtsauskunft“ | Claude Entwurf | 🔲 **Test-Zugang klären**: Der Prüfer braucht einen Weg, sich anzumelden (eigene Test-Adresse mit Zugriff für dich) |
| Händlerstatus (EU/DSA): kostenlos, ohne Werbung → „kein Händler“ | Nutzer | 🔲 [A] |
| Name „Fangpunkt“ im App Store frei / Markenlage | Nutzer | 🔲 [O] |

## D. Inhalte, die vor dem Einreichen gegengeprüft sein sollten

- Knoten (6 von 9 noch nicht gegengeprüft), Montagen, Köderführung – Inhalte vom Nutzer noch offen.
- Rechtsdaten: alle 16 Länder `partial` mit Liste der Lücken, nächste Prüfung ab März 2027 (Workflow „Rechtsdaten prüfen“).
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

Fangbuch, Routen (auch die Hintergrund-Aufzeichnung der iPhone-App), nicht geteilte Orte und Fotos bleiben auf dem Gerät → „nicht erfasst“.
