# BACKUP_PLAN.md – Sicherung des Fangbuchs auf dem Server (Planung)

Stand: 2026-11-23 · Status: **Planung, Entscheidungen des Nutzers eingetragen (§7), Entwurf D wartet auf Freigabe**. Es ist noch nichts gebaut.

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

## 3. Optionen (Auswahl: D, zuerst nur Backup)

Der Nutzer hat am 2026-11-23 **Option D** (Daten in Postgres-Tabellen, später Mehrgeräte-Sync) gewählt, mit der Reihenfolge **erst Sichern und Wiederherstellen, Sync später**. Die Optionen A bis C der ersten Fassung (Hinweis, ZIP-Archiv, inkrementelle Dateien) sind damit nicht gewählt; sie stehen im Verlauf von Git (Commit f992626).

## 4. Entwurf D (Vorschlag, wartet auf Freigabe)

### Aufbau
- **Eine gemeinsame Tabelle statt einer Tabelle je Entität:** `backup_items (user_id, kind, item_id, rev, deleted, data jsonb, updated_at)`. `kind` = catch/place/session/trip/bait/paper/waterRule/waterLink/post … Vorteil: neue Entitäten brauchen keine Migration, Sync und Löschmarken (`deleted`) sind von Anfang an vorgesehen, eine einzige RLS-Regel (nur der Eigentümer). Nachteil: Auswertungen auf dem Server und Typprüfung in der Datenbank entfallen; die Prüfung übernimmt Zod in der App (dieselben Schemata wie Import). **Abweichung vom Wunsch „je Entität eine Tabelle“ – bitte bestätigen.**
- **Routen** (viele Punkte) und **Fotos** liegen nicht in der Tabelle, sondern im privaten Speicher `backups` (`<Nutzer>/routes/<Session>.json`, `<Nutzer>/photos/<Foto-ID>.jpg`), in `backup_items` steht nur der Verweis. Die Datenbank bleibt klein.
- **Schreiben nur über Funktionen** (`backup_put(items)`, `backup_list(since)`, `backup_delete_all()`, `backup_usage()`), keine Tabellenrechte für Nutzer; Sperr-Trigger wie bei den anderen Tabellen; höchstens 500 MB je Nutzer (`backup_quota`).
- **Sync-fähig vorbereitet:** jede Zeile hat eine vom Server vergebene, wachsende `rev`; die App merkt sich je Gerät die zuletzt gesehene `rev`. In der ersten Version schreibt nur dieses Gerät („letzter Stand gewinnt“, kein Zusammenführen); der Abruf `backup_list(since)` ist schon da, damit der Sync später ohne Umbau folgen kann.
- **Wiederherstellen:** Abruf aller Zeilen, Prüfung mit den App-Schemata, danach der bestehende Import mit Vorschau (`planImport`).

### Standard und Zustimmung (Entscheidung Nutzer, Empfehlung angenommen)
- Die Sicherung ist für angemeldete Nutzer **standardmäßig an, aber erst nach einer einmaligen, klaren Zustimmung** beim ersten Anmelden (Fenster: Fangbuch samt Orten, Routen und Fotos auf dem Server sichern – Ja/Nein). Ohne Ja wird nichts hochgeladen. Später jederzeit unter Daten & Sicherung ausschaltbar, „Cloud-Sicherung löschen“ entfernt alles.
- Bestehende angemeldete Nutzer sehen das Fenster einmal nach dem Update (wie „Neu in Fangpunkt“).
- Datenschutzseite, `privacy.spec.ts`, CLAUDE.md („Fangdaten bleiben lokal“ wird zu „lokal; Sicherung auf dem Server nur nach Zustimmung“), App-Store-Datenschutzlabel (mit dem Nutzer verknüpfte Daten: Standort, Fotos) anpassen.
- Nur der Eigentümer liest (RLS); auch Moderatoren nicht. „Konto löschen“ entfernt Zeilen und Dateien vorher.
- Verschlüsselung: Supabase im Ruhezustand (Server kann lesen); Ende-zu-Ende nicht in der ersten Version.

## 5. Umsetzung in Etappen (je ein PR)

1. **Server** `*_cloud_backup.sql`: Tabelle `backup_items`, Speicher `backups`, Funktionen, Quota, Konto-Löschen, Server-Test `supabase/tests/cloud_backup.sql`; `admin_security.sql` bleibt grün.
2. **Domain** `domain/cloudBackup.ts`: Plan (was ist neu/geändert/gelöscht), Zeilenform, Quota-Rechnung, Prüfung beim Wiederherstellen. Reine Logik mit Tests.
3. **Dienst + Hintergrund** `data/cloudBackupService.ts`, `features/backup/CloudBackupSync.tsx` (ein Lauf gleichzeitig, Pausen bei Fehlern, höchstens 1× je Stunde, Fotos zuletzt).
4. **Oberfläche**: Zustimmungsfenster, Schalter, Stand, Speicherverbrauch, Wiederherstellen, Löschen; `BackupReminder` zählt eine aktuelle Cloud-Sicherung als Sicherung.
5. **Tests/Doku**: E2E mit nachgebildetem Server, TEST_PLAN, Datenschutzseite, Changelog, CLAUDE.md.
6. **Später (eigene Freigabe):** Mehrgeräte-Sync mit Konfliktregeln.

## 6. Kosten (Orientierung, **[O]** Preise im Dashboard prüfen)

Wie in der ersten Fassung (Fotos sind fast der gesamte Bedarf, ca. 120 MB je aktivem Nutzer). Da die Sicherung für zustimmende Nutzer standardmäßig läuft, ist mit mehr Nutzern als bei „Standard aus“ zu rechnen: ab ca. 8 aktiven Nutzern reicht der Free-Tarif (ca. 1 GB Dateien, **[O]**) nicht mehr, dann Pro.

| Szenario | Speicher gesamt | Tarif |
|---|---|---|
| 10 aktive Nutzer | ca. 1,2 GB | Pro nötig |
| 100 aktive Nutzer | ca. 12 GB | Pro |
| 500 aktive Nutzer | ca. 60 GB | Pro |

## 7. Entscheidungen (Stand 2026-11-23)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Form | **D** (Postgres), zuerst nur Backup, Sync später |
| 2 | Standard | An für Angemeldete, **mit einmaliger Zustimmung beim Anmelden** |
| 3 | Fotos | Ja, mit der Sicherung |
| 4 | Grenze je Nutzer | 500 MB |
| 5 | Tarif | **Pro ab Livegang der App** (Nutzer 2026-11-23). Bis dahin Free: Die Cloud-Sicherung wird gebaut, aber erst mit dem Upgrade für alle Nutzer eingeschaltet (Free: 1 GB Dateien, Pause nach einer Woche ohne Aktivität) |
| 6 | Verschlüsselung | Supabase (erste Version) – noch nicht ausdrücklich bestätigt |
| 7 | Mehrgeräte-Sync | Später, Tabelle wird vorbereitet |
| 8 | **Neu:** eine gemeinsame Tabelle `backup_items` statt je Entität eine Tabelle | **offen, bitte bestätigen** |

## 7a. Fotos nicht doppelt speichern (Vorschlag, noch nicht gebaut)

Ein Foto, das als Beitrag geteilt wird, liegt schon im Speicher `post-photos` (1600 px, dazu `<Nr>.thumb.jpg` und seit PR #222 `<Nr>.mid.jpg` für den Feed). Die Cloud-Sicherung soll es nicht ein zweites Mal kopieren, sondern in `backup_items` auf die Datei verweisen. Voraussetzung: gemeinsame Aufräumregel (Löschen des Beitrags entfernt die Datei nicht, solange die Sicherung darauf zeigt – oder die Sicherung behält eine eigene Kopie, wenn der Beitrag gelöscht wird). Das ist in Etappe 1 (Server) zu entscheiden.

**Bildumrechnung von Supabase (Image Transformations)** geprüft: nur Pro, 100 Originalbilder im Monat inklusive, danach 5 $ je 1.000 verschiedene Originalbilder. Bei einigen tausend Fotos teurer als eigene Größen; deshalb erzeugt die App die mittlere Größe selbst.

## 8. Offene Prüfungen

- [O] Aktuelle Tarif-Grenzen und Preise (Free/Pro) im Supabase-Dashboard bestätigen.
- [O] Größen echter Fangfotos messen (bisher nur 22 Testdateien, davon Vorschaubilder).
- [O] Maximale Dateigröße je Datei im gewählten Tarif.
- [O] Rechtliche Prüfung der Zustimmungstexte (Standort, Fotos) vor der Einreichung im App Store.
