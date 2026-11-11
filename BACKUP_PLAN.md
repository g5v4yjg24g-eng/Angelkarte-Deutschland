# BACKUP_PLAN.md – Sicherung des Fangbuchs auf dem Server (Planung)

Stand: 2026-11-11 · Status: **Planung, wartet auf Freigabe** (Entscheidungen siehe §7). Es ist noch nichts gebaut.

## 1. Ausgangslage

- Fangbuch (Fänge, Orte, Sessions, Routen, Termine, Köder, eigene Gewässerregeln/-links, Fangfotos) liegt **nur auf dem Gerät** (Dexie). Das ist bewusst so (CLAUDE.md „Fangdaten bleiben lokal“).
- Heute sichert man per Hand: Mehr → Daten & Sicherung (ZIP/JSON, `data/backupService.ts`, Format `domain/backup/format.ts`, Import mit Vorschau `domain/backup/plan.ts`). Eine Erinnerung (`BackupReminder`) erscheint ab 5 Änderungen oder 14 Tagen.
- Auf dem Server liegen schon: Konto, Profil, Beiträge samt Fotos (`post-photos`), Profilbild (`avatars`), Folgen, Spots, Sessions-Einladungen u. a.
- Fotos werden beim Speichern auf **max. 1600 px, Qualität 0,8** neu kodiert (`domain/photo.ts`), dazu eine Vorschau mit 320 px.

## 2. Zahlen (Stand 2026-11-11, gemessen im Supabase SQL-Editor)

| Messwert | Wert |
|---|---|
| Datenbank | 13 MB |
| `post-photos` | 22 Dateien, 7.136 kB, im Schnitt 324 kB (enthält Vorschaubilder) |
| `avatars` | 2 Dateien, 220 kB |

Hochrechnung je aktivem Nutzer (Annahmen, noch nicht gemessen):

| Inhalt | Annahme | Größe |
|---|---|---|
| Fänge, Orte, Sessions, Termine, Köder (JSON) | 1.000 Einträge à ca. 2 KB | ca. 2 MB |
| Routen | 50 Sessions à ca. 100 KB | ca. 5 MB |
| Fangfotos (1600 px, ohne Vorschau) | 300 Fotos à ca. 400 kB | ca. 120 MB |

→ Die Fotos sind fast der gesamte Bedarf. Daten und Routen sind vernachlässigbar.

Tarif-Grenzen (aus dem Gedächtnis, **[O] vor der Entscheidung im Supabase-Dashboard prüfen**): Free ca. 1 GB Dateien / 500 MB Datenbank, **max. 50 MB je Datei**; Pro ca. 100 GB Dateien inklusive, danach Abrechnung je GB.

## 3. Optionen

### A – Nur Hinweis dezenter (nichts bauen)
Erinnerung seltener (z. B. ab 20 Änderungen oder 30 Tagen). Kein Serverbedarf, keine Datenschutzänderung. Risiko bleibt: Gerät weg = Fangbuch weg.

### B – Cloud-Sicherung als Archiv (ein ZIP je Nutzer)
Bestehendes ZIP-Format hochladen. Einfach, aber jede Sicherung lädt **alle** Fotos neu hoch (hunderte MB) und stößt auf die 50-MB-Dateigrenze im Free-Tarif. **Nicht empfohlen.**

### C – Cloud-Sicherung inkrementell (empfohlen)
- Daten als eine kleine Datei `backup.json` (derselbe Inhalt wie das bisherige Archiv ohne Fotos) + **Fotos einzeln** unter `<Nutzer>/photos/<Foto-ID>.jpg`. Nur neue oder geänderte Fotos werden hochgeladen (wie bei den Beitragsfotos, `postSyncService`).
- Privater Speicher `backups` (Pfad beginnt mit der Nutzer-ID, RLS: nur der Eigentümer; **auch Moderatoren lesen nichts**).
- Automatisch im Hintergrund, nur mit Konto **und** eingeschaltetem Schalter (Standard aus, siehe §7): nach Änderungen, höchstens 1× je Stunde, Fotos nur bei WLAN-Wahl optional.
- Wiederherstellen = bestehender Import mit Vorschau (`planImport`), die Datei wird nur heruntergeladen und wie ein manuell gewähltes Archiv behandelt. Keine neue Konfliktlogik.
- Kein Mehrgeräte-Abgleich (das wäre ein eigenes, größeres Projekt: Sync mit Konfliktlösung). Die Sicherung ist ein **Backup, kein Sync**.

### D – Alles in Postgres-Tabellen (je Entität eine Tabelle)
Ermöglicht späteren Sync und Auswertungen, aber viel Aufwand (Schema, RLS, Migrationen je Entität, Server-Tests) und Datenbank wächst mit Routen. Für reines Backup übertrieben. Nur sinnvoll, wenn Mehrgeräte-Sync das Ziel wird.

## 4. Empfehlung: Option C

Warum: kleinster Aufwand, nutzt vorhandenes Format und Import, wächst fast nur mit den Fotos, lässt sich später zu D oder Sync ausbauen.

### Datenschutz (Entscheidung nötig)
- Fangorte (genaue Koordinaten), Routen und Fotos lägen dann **auf dem Server** – das ändert die Regel „Fangdaten bleiben lokal“. Deshalb: **freiwillig, Standard aus**, klare Zustimmung beim Einschalten, Eintrag in der Datenschutzseite (`PrivacyPage.tsx`), CLAUDE.md und `privacy.spec.ts` anpassen.
- Nur der Eigentümer kann lesen (RLS). Keine Weitergabe, kein Feed, keine Auswertung.
- **Löschen:** „Cloud-Sicherung löschen“ in der App; „Konto löschen“ entfernt die Dateien vorher (wie bei Beitragsfotos).
- Verschlüsselung: Standard = Supabase-Verschlüsselung im Ruhezustand (Server kann lesen). Ende-zu-Ende (Passphrase) wäre möglich, hat aber den Nachteil „Passphrase weg = Sicherung weg“ und wird **nicht** empfohlen für die erste Version.

### Grenzen
- Höchstens ca. 500 MB je Nutzer (Server prüft vor dem Hochladen, Fehler `backup_quota`), Anzeige „x MB von 500 MB“.
- Sicherung zeigt nach dem Hochladen eine Gegenprobe (Anzahl Fotos auf dem Server = lokal).
- Höchstens 2 Stände von `backup.json` (aktuell + vorheriger), damit eine kaputte Sicherung nie die letzte gute ersetzt.

## 5. Umsetzung in Etappen (je ein PR)

1. **Server** `*_cloud_backup.sql`: Speicher `backups` (privat, Pfadregel `<Nutzer>/…`, nur JPEG/JSON, Größe je Datei begrenzt), Funktionen `backup_usage()` (Dateien, Bytes), `delete_my_backup()`; Konto-Löschen entfernt die Dateien. Server-Test mit echten Rechten (`supabase/tests/cloud_backup.sql`), `admin_security.sql` bleibt grün.
2. **Domain** `domain/cloudBackup.ts`: Plan, was hochgeladen werden muss (Foto-IDs, `updatedAt`), Prüfung der heruntergeladenen Datei mit `parseBackupText`, Quota-Rechnung. Reine Logik, mit Tests.
3. **Dienst + Hintergrund** `data/cloudBackupService.ts`, `features/backup/CloudBackupSync.tsx` (ein Lauf gleichzeitig wie `PostSync`, Pausen bei Fehlern, Einstellung `cloudBackup`).
4. **Oberfläche** unter Daten & Sicherung: Schalter mit Zustimmung, Stand („zuletzt gesichert …“, Fehler mit „Erneut versuchen“), Speicherverbrauch, „Wiederherstellen“ (öffnet Import-Vorschau), „Cloud-Sicherung löschen“. `BackupReminder` zählt eine erfolgreiche Cloud-Sicherung als Sicherung (kein Hinweis, solange sie aktuell ist).
5. **Tests/Doku**: E2E mit nachgebildetem Server (`account.spec.ts`-Stil), TEST_PLAN, Datenschutzseite, Changelog „Cloud-Sicherung“, CLAUDE.md.

Aufwand grob: 4–5 PRs, vergleichbar mit der Termin-Einladung.

## 6. Kosten (Orientierung, **[O]** Preise im Dashboard prüfen)

| Szenario | Fotos je Nutzer | Speicher gesamt | Tarif |
|---|---|---|---|
| 10 aktive Nutzer | ca. 120 MB | ca. 1,2 GB | Free reicht knapp nicht → Pro |
| 100 aktive Nutzer | ca. 120 MB | ca. 12 GB | Pro (inkl. ca. 100 GB) |
| 500 aktive Nutzer | ca. 120 MB | ca. 60 GB | Pro |

Rechnung gilt nur, wenn alle Nutzer die Sicherung einschalten (Standard aus → real weniger). Datenverkehr entsteht beim Hochladen (nicht abgerechnet) und beim Wiederherstellen (selten).

## 7. Entscheidungen, die ich von dir brauche

1. **Soll es überhaupt eine Cloud-Sicherung geben?** (Option A, C oder D) – Empfehlung: C.
2. **Standard:** aus mit Zustimmung (empfohlen) oder an für alle Angemeldeten?
3. **Fotos mitsichern?** Ja (empfohlen, aber Hauptkostentreiber) / nur Daten / Fotos als eigener Schalter.
4. **Grenze je Nutzer:** 500 MB (Vorschlag) oder anderer Wert.
5. **Tarif:** Free bis zum ersten Engpass, dann Pro – oder gleich Pro?
6. **Verschlüsselung:** nur Supabase (empfohlen) oder Ende-zu-Ende.
7. **Später Mehrgeräte-Sync** gewünscht? (Dann lieber Option D statt C.)

## 8. Offene Prüfungen

- [O] Aktuelle Tarif-Grenzen und Preise (Free/Pro) im Supabase-Dashboard bestätigen.
- [O] Größen echter Fangfotos messen (bisher nur 22 Testdateien, davon Vorschaubilder).
- [O] Maximale Dateigröße je Datei im gewählten Tarif.
