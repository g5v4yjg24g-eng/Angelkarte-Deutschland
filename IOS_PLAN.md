# iPhone-App (App Store) – Plan

Stand 2026-11-02. Wunsch Nutzer: mit Apple anfangen (kein Android-Gerät vorhanden), **kein Mac**.
Status: **Etappe 1 umgesetzt** (Freigabe Nutzer 2026-11-03, Bundle-ID `com.fangpunkt.app`): Capacitor 8.5.3, iOS-Projekt `app/ios/`
(Swift Package Manager), Bau `pnpm -C app build:ios`, Workflow `.github/workflows/ios.yml` (von Hand starten → TestFlight).
Wartet auf: App in App Store Connect + Secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`.
Erste Version am 2026-11-03 zu TestFlight hochgeladen [V, Lauf 41623461713]. Erkenntnisse: Schlüssel braucht Rolle **Admin**
(Teamschlüssel); Archiv wird **unsigniert** gebaut (Entwickler-Signatur bräuchte ein registriertes Gerät), signiert wird
beim Export für den App Store; Apple-Chip-Runner oft ausgelastet → Standard `macos-15-intel` (wählbar beim Start);
Prüfschritt `ios/ci/check-asc.mjs` testet die Zugangsdaten vorab und gibt **nie** Secret-Inhalte aus.
Gewünschte Gerätefunktionen (Nutzer 2026-11-02): Erinnerungen, Teilen, Kamera & Fotos, Haptik.

Kennzeichnung: **[V]** verifiziert (Quelle, Datum), **[A]** Annahme, **[O]** offen.

## 1. Weg

Die bestehende Web-App wird mit **Capacitor** als echte iPhone-App verpackt (WKWebView + native Plugins).
Gebaut, signiert und zu TestFlight hochgeladen wird auf einem **Cloud-Mac in GitHub Actions** – ein eigener Mac ist nicht nötig.

| Baustein | Wo | Mac nötig? |
|---|---|---|
| App anlegen, Store-Eintrag, Datenschutzangaben, Einreichen | App Store Connect im Browser | nein |
| iOS-Projekt (`app/ios/`) erzeugen und pflegen | Capacitor-CLI, läuft auch unter Linux [A] | nein |
| Bauen, Signieren, Hochladen | GitHub Actions (`macos`-Runner) mit App-Store-Connect-API-Schlüssel | Cloud-Mac |
| Testen | TestFlight auf dem iPhone des Nutzers | nein |

Warum nicht als reine PWA einreichen: Apple nimmt keine PWA-Pakete an; reine „verpackte Webseiten“ lehnt die Prüfung
nach Regel 4.2 (Minimum Functionality) häufig ab. Deshalb echte Gerätefunktionen (§4) und Erklärung im Prüfhinweis.

Alternative für den Bau, falls GitHub Actions nicht passt: Codemagic (500 kostenlose macOS-Minuten/Monat für
Privatkonten, Doku codemagic.io, abgerufen 2026-11-02) [A].

## 2. Was der Nutzer tun muss (nur er kann das)

1. **Apple Developer Program** als Einzelperson mit echtem Namen (99 $/Jahr, in DE voraussichtlich 99 € [A]).
   Über die App „Apple Developer“ oder developer.apple.com. Freischaltung meist 1–2 Tage [A].
2. **App in App Store Connect anlegen**: Name, Primärsprache Deutsch, Bundle-ID (Vorschlag `de.fangpunkt.app` [O], vorher abstimmen), SKU.
3. **API-Schlüssel** (App Store Connect → Benutzer und Zugriff → Integrationen → App Store Connect API, Rolle „App Manager“)
   und als **GitHub-Secrets** hinterlegen: Key-ID, Issuer-ID, `.p8`-Inhalt. Nie ins Repo, nie in den Chat.
4. **Händlerstatus (EU/DSA)** angeben: kostenlose App ohne Werbung → voraussichtlich „kein Händler“ [A].
5. **Steuer/Banking** entfällt bei einer kostenlosen App [A].
6. Testen über **TestFlight**, am Ende „Zur Prüfung einreichen“.

## 3. Umbau im Code (Etappe 1 – Hülle und Bau)

- Abhängigkeiten: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` (aktuelle Hauptversion; Swift Package Manager statt CocoaPods, damit unter Linux pflegbar [A]).
- `app/capacitor.config.ts`: `appId`, `appName: 'Fangpunkt'`, `webDir: 'dist'`.
- Eigener Build-Modus für die App: `BASE_PATH=/`, **ohne Service Worker** (Dateien liegen ohnehin in der App); `UpdatePrompt` und SW-Registrierung nur im Web.
  Erkennung über `Capacitor.isNativePlatform()` an **einer** Stelle (`lib/platform.ts`).
- `Info.plist`: Begründungstexte (Deutsch) für Standort (`NSLocationWhenInUseUsageDescription`), Kamera (`NSCameraUsageDescription`),
  Fotos (`NSPhotoLibraryUsageDescription`); `ITSAppUsesNonExemptEncryption = NO` (nur HTTPS) [A].
- App-Symbol 1024 px und Startbild aus dem Fisch-Master (`pnpm icons` erweitern).
- Workflow `.github/workflows/ios.yml` (nur manuell oder per Tag): `pnpm build:ios` → `npx cap sync ios` → `xcodebuild archive`
  mit automatischer Signierung über den API-Schlüssel (`-allowProvisioningUpdates`) → Export → Upload zu TestFlight [A, beim Einrichten prüfen].
  Läuft erst, wenn die Secrets da sind; sonst bricht er mit klarer Meldung ab.
- Laut mehreren Drittquellen sind Standard-macOS-Runner für öffentliche Repos kostenlos [A]; das Repo ist öffentlich [V 2026-11-02]. Vor dem Einrichten offiziell prüfen.

**CORS [V 2026-11-03, curl mit `Origin: capacitor://localhost`]:** Open-Meteo, Bright Sky, OpenFreeMap, PEGELONLINE,
OpenGeoData.NRW und GoatCounter antworten mit `Access-Control-Allow-Origin: *`. Am Gerät noch zu bestätigen [O].

~~**Prüfen in Etappe 1 [O]:**~~ Fremddienste antworten der App-Herkunft `capacitor://localhost` (CORS): Open-Meteo, Bright Sky, PEGELONLINE,
OpenHygon NRW, OpenFreeMap, GoatCounter, eigene PMTiles auf GitHub Pages. Falls einer nicht mitspielt: native HTTP-Brücke von Capacitor nur für diesen Adapter.

## 4. Gerätefunktionen (Etappe 2) – alle über `ports/` + `adapters/`

Je Funktion ein Port mit Web-Adapter (heutiges Verhalten) und Capacitor-Adapter; Komponenten kennen nur den Port.

| Funktion | Plugin | Einsatz | Hinweis |
|---|---|---|---|
| **Erinnerungen** | `@capacitor/local-notifications` | Mitteilung vor Angelterminen (`trips`), Sicherungs-Erinnerung | Lokal, ohne Server. Einstellung „Erinnerungen“ + Vorlaufzeit; Planen/Neuplanen bei jeder Änderung eines Termins (rein: Logik `domain/reminders.ts`) |
| **Teilen** | `@capacitor/share` (+ `@capacitor/filesystem` für Dateien) | Sicherung (ZIP), CSV, Kalenderdatei, Fang/Beitrag teilen | Ersetzt `downloadBlob` in der App; im Web bleibt der Download |
| **Kamera & Fotos** | `@capacitor/camera` | Fangfoto, Profilbild, Beitrag | `<input type=file>` öffnet in iOS schon Kamera/Fotos – Plugin bringt v. a. Apples Fotoauswahl; Fotos laufen weiter durch `processPhoto` (EXIF weg) |
| **Push-Mitteilungen** ✅ (Wunsch Nutzer 2026-11-04, direkt über Apple) | `@capacitor/push-notifications` 8.1.3 | Freundschaftsanfragen, Gefällt mir, Kommentare, geteilte Spots | Server: `*_push.sql` + Edge Function `send-push` (APNs, ES256). Nutzer: Push-Fähigkeit am Identifier, APNs-Schlüssel (.p8) als Secrets, Function mit genau diesem Namen, „Verify JWT“ aus. Auf dem Gerät noch ungeprüft [O] |
| **Haptik** ✅ (2026-11-06, Weg 1) | `@capacitor/haptics` 8.0.2 | Fang gespeichert, Gefällt mir, Wischen über die Leiste | Kurz und sparsam; abschaltbar in den Einstellungen; auf dem Gerät noch ungeprüft [O] |
| **Tastatur** ✅ (2026-11-06, Weg 1) | `@capacitor/keyboard` 8.0.6 | Ansicht wird kleiner statt hochgeschoben, Leiste weg bei offener Tastatur | Dazu `scrollEnabled: false`, `allowsLinkPreview: false`, kein Markieren/Zoomen der Oberfläche (`app/nativeShell.ts`) |

Optional später: `@capacitor/geolocation` (vermeidet die doppelte Standort-Frage der Webansicht [A]).

**Hintergrund-Route bei Sessions** (Wunsch Nutzer 2026-11-03, direkt nach der ersten TestFlight-Version, vor dem Einreichen):
natives Modul zeichnet den Standort auch bei gesperrtem Bildschirm auf, nur während einer laufenden Session
(blaues Standort-Symbol von iOS, Berechtigung „Immer“, `UIBackgroundModes: location`), Punkte grob genug für den Akku;
die Web-App übernimmt sie beim Öffnen in `tracks`. Plugin vor Einbau auswählen und begründen [O]. Apple prüft
Hintergrund-Standort streng → Zweck im Prüfhinweis erklären; Datenschutzseite + Website ergänzen.

**Moderationsbereich** (Wunsch Nutzer 2026-11-04, Variante A, `MODERATION_PLAN.md`): gebaut 2026-11-05 (Mehr →
Moderation, nur für Moderatoren) – Meldungen ansehen, Inhalte löschen, Nutzer sperren/entsperren mit Mail.

## 5. Store-Material (Etappe 3)

> **Stand 2026-11-06:** Die Datenschutzangaben und die Altersfreigabe unten sind veraltet (seit Konto, Feed und Freunden gibt es Inhalte zwischen Nutzern). Aktuell gilt `RELEASE_CHECKLIST.md` (Abschnitte C und E).

- **Datenschutzerklärung als eigene, öffentlich erreichbare Seite** (statische HTML-Datei auf GitHub Pages, nicht die SPA-Route), Inhalt aus `PrivacyPage`, um „iPhone-App“ ergänzt.
- **Support-Adresse**: einfache Seite oder GitHub-Issues [O – Nutzer entscheidet, welche E-Mail sichtbar sein soll].
- **App-Datenschutzangaben** (Entwurf, vor Abgabe prüfen):
  - Standort (ungefähr): für App-Funktion (Wetter, gerundet), nicht mit Person verknüpft, kein Tracking.
  - Nutzungsdaten: GoatCounter-Zählung (nur Bereichspfade), nicht verknüpft, kein Tracking; in der App abschaltbar.
  - Fotos, Fangbuch, Profil: bleiben auf dem Gerät → „nicht erfasst“.
- **Altersfreigabe**: Fragebogen; Profil/Kommentare sind nur lokal → keine nutzergenerierten Inhalte zwischen Nutzern [A].
- **Beschreibung, Stichworte, Screenshots** (vom iPhone des Nutzers, Größe ggf. anpassen; nur echte Funktionen, Kennzeichnung „Beispieldaten“ wie im Marketing).
- **Prüfhinweis an Apple**: Zweck, kein Konto nötig, wofür Standort/Kamera, die nativen Funktionen aus §4, Recht = „keine Rechtsauskunft“.
- **Name „Fangpunkt“** im App Store noch frei? Markenlage ungeprüft [O].

## 6. Folgen und Risiken

- **Updates langsamer:** Jede Änderung in der App braucht einen neuen Bau + Apple-Prüfung (meist 1–2 Tage). Die Web-App aktualisiert sich weiter sofort. Vorschlag: App-Versionen gebündelt, z. B. alle 1–2 Wochen.
- **Getrennte Daten:** Homescreen-PWA und App speichern getrennt. Umzug über „Daten & Sicherung“ (Export in Safari → Dateien → Import in der App). Hinweis in der App und im Store-Text.
- **Ablehnung nach 4.2** bleibt möglich → dann mehr native Funktionen (z. B. Widget) oder bessere Begründung.
- **Konto/Freunde später:** In-App-Kontolöschung ist vorhanden; sobald Inhalte zwischen Nutzern sichtbar werden, verlangt Apple Melden/Blockieren/Moderation (Regel 1.2) [A].
- **Fehlersuche ohne Mac:** jeder Versuch = Cloud-Bau + TestFlight (~15–30 min).
- **„Offline verfügbar“** in Store-Texten nur, wenn ein Test es belegt (CLAUDE.md).

## 7. Reihenfolge und grober Aufwand [A]

| Schritt | Wer | Dauer |
|---|---|---|
| 0. Entwicklerkonto, App anlegen, API-Schlüssel, Secrets | Nutzer | 1–3 Tage (Wartezeit Apple) |
| 1. Capacitor-Hülle, App-Build-Modus, CI zu TestFlight | Claude | 1 PR |
| 2. Erste TestFlight-Version auf dem iPhone, CORS/Standort prüfen | beide | 1 Tag |
| 3. Erinnerungen + Teilen | Claude | 1–2 PRs |
| 4. Kamera & Fotos + Haptik | Claude | 1 PR |
| 5. Datenschutzseite, Store-Texte, Datenschutzangaben, Screenshots | Claude + Nutzer | 1 PR + Eingaben |
| 6. Einreichen, ggf. Nachbessern | Nutzer (Claude bereitet vor) | 1–7 Tage |

Kosten: 99 $/Jahr Apple; Bau in GitHub Actions voraussichtlich 0 € (öffentliches Repo) [A].

## 8. Zur Freigabe offen

1. Capacitor als neue Abhängigkeit (+ Plugins aus §4) – **nicht freigegeben**.
2. Bundle-ID und sichtbarer Entwicklername/Support-Kontakt.
3. Bau über GitHub Actions (Empfehlung) oder Codemagic.

Quellen (abgerufen 2026-11-02, überwiegend Drittquellen): Apple Account-Hilfe developer.apple.com/support/enrollment;
Codemagic-Preise docs.codemagic.io/billing/pricing; zu Regel 4.2 u. a. capgo.app/blog/how-to-pass-app-store-review-2026;
DSA-Händlerangaben 9to5mac.com/2025/02/18/apple-trader-information-app-store.
