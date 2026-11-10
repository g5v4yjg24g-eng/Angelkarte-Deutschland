# Moderationsbereich in der App (Plan, Variante A)

Entscheidung Nutzer 2026-11-04: **Variante A** – versteckter Moderationsbereich in der App statt SQL-Befehlen.
Status: **gebaut (2026-11-05)**, Server-Teil vom Nutzer einzuspielen. War Pflicht vor dem nächsten Upload zu Apple (TestFlight/App Store):
Apple erwartet, dass auf Meldungen reagiert werden kann (Inhalte entfernen, Nutzer ausschließen).

## Ausgangslage
- Meldungen landen in `public.reports` und per Mail bei moderation@fangpunkt.com (`*_moderation.sql`,
  Edge Function `notify-report`, Adresse `hyper-function`).
- Ansehen/Eingreifen geht bisher nur im SQL-Editor; eine **Sperre (Bann) gibt es noch nicht**.

## Umfang
1. **Wer darf moderieren:** Server-Tabelle `moderators(user_id)` (RLS, nur lesbar für sich selbst, keine
   Schreibrechte aus der App). Eintrag nur durch den Datenbank-Eigentümer im SQL-Editor über die Nutzer-ID
   (wie FOUNDER, nie im Repo). Hilfsfunktion `is_moderator()`. Jede Moderationsfunktion prüft sie selbst
   (`security definer`), die App blendet den Bereich nur ein.
2. **Mehr → Moderation** (nur sichtbar für Moderatoren):
   - Liste **offener Meldungen** (neueste zuerst, Zahl als Kennzeichen), Filter offen/erledigt.
   - **Meldung öffnen:** gemeldeter Inhalt mit Fotos (zeitlich begrenzte Adressen), Kommentar mit Beitrag, Spot,
     Grund, Hinweis, wer gemeldet hat.
   - **Person ansehen:** alle Beiträge, Kommentare, geteilten Spots; frühere Meldungen gegen sie; Sperrstatus.
   - **Aktionen:** „Inhalt löschen“ (Beitrag samt Fotos im Speicher / Kommentar / Spot), „Verwarnen“ (Vermerk),
     „Sperren“ / „Sperre aufheben“, „Meldung erledigt“ (mit Notiz). Jede Aktion mit Bestätigung.
3. **Sperren:** Tabelle `bans(user_id, reason, until, by, created_at)`; Wirkung:
   - Anmeldung verhindern (`auth.users.banned_until` über eine Funktion setzen; laufende Sitzung endet spätestens
     mit Ablauf des Tokens),
   - Inhalte für alle unsichtbar (`can_see_post`, `can_see_spot`, Kommentar-/Like-Listen, Feed prüfen `is_banned`),
   - keine Schreibrechte mehr (alle Schreib-Funktionen prüfen `is_banned`), keine Push-Mitteilungen von ihr.
4. **Protokoll:** Tabelle `moderation_log` (wer, was, wann, Meldung) – nachvollziehbar, nur für Moderatoren.
5. **Mail-Verknüpfung:** Link in der Meldungs-Mail direkt zur Meldung in der App (`/mehr/moderation/<id>`).
6. **Datenschutz:** Datenschutzseite (App + fangpunkt.com) um Sperren und Protokoll ergänzen.
7. **Tests:** Rechte (Nicht-Moderator kommt nirgends ran, auch nicht per RPC), Sperre wirkt überall, E2E für
   Liste → Meldung → Inhalt löschen → Sperren → Aufheben; 390 px, hell/dunkel.

## Entschieden (beim Bau geklärt)
- Sperre 1/7/30 Tage oder dauerhaft; Mail an die Person beim Sperren und Aufheben (Nutzer 2026-11-04).

## Ausbau: Admin-Bereich (Stand 2026-11-10, alles live)
Eigener Bereich unter `/moderation` mit eigener Leiste **Übersicht · Meldungen · Nutzer · Verwaltung**
(Details und Dateien in `CLAUDE.md`, Abschnitt „Admin-Bereich“; Tests in `TEST_PLAN.md` ADM-1 … ADM-5).

| PR | Inhalt | Server |
|---|---|---|
| #145 | Admin-Rahmen, Übersicht mit echten Zahlen | `*_mod_overview.sql` |
| #146 | Meldungsverwaltung: Stand, Filter, Ausblenden/Wiederherstellen, Pflichtgrund, Verlauf, meldende Person nur auf Knopfdruck, 50 Eingriffe/24 h | `*_mod_reports_v2.sql` |
| #147 | Nutzerverwaltung: Liste/Suche (E-Mail nur Founder), Verwarnungen mit Mail, dauerhafte Sperre nur mit Passwort, Schreibsperre | `*_mod_users.sql` |
| #148 | Gesperrte Nutzernamen, Moderationsprotokoll, Statistik, Rollen Founder/Moderator | `*_mod_admin_tools.sql` |
| #149 | Community-Regeln mit Fassungen, neue Zustimmung | `*_community_rules.sql` |
| #150 | Einsprüche über Link in der Sperr-Mail | `*_appeals.sql` + Function `notify-report` |
| QS | Rechte-Gesamtprüfung aller Admin-Funktionen, Härtung zweier Hilfsfunktionen, 390-px-Korrekturen | `*_admin_hardening.sql` |

### Sicherheit (geprüft in `supabase/tests/admin_security.sql`, läuft gegen alle Migrationen)
- **Jede** Funktion `mod_*` lehnt normale Konten und Aufrufe ohne Anmeldung ab – auch künftige, weil der Test sie
  automatisch aus der Datenbank sammelt. Ausnahme: `mod_my_role`/`mod_can_search_email` verraten nur den eigenen Stand.
- Ohne Anmeldung aufrufbar sind genau `current_rules`, `appeal_info`, `submit_appeal`.
- Alle Tabellen in `public` haben RLS; jede `security definer`-Funktion hat einen festen `search_path`.
- Rollen, Moderatoren, Abzeichen, Sperren, Protokoll lassen sich aus der App weder lesen noch schreiben; vergeben wird
  nur im SQL-Editor über die Nutzer-ID.
- Gegen ein kompromittiertes Moderatorenkonto: höchstens 50 Eingriffe in 24 h, dauerhafte Sperre nur mit frischer
  Passwort-Anmeldung, Regeln veröffentlichen und per E-Mail suchen nur als Founder, jede Aktion im Protokoll.
- Bewusst nicht automatisch: keine Sperre nach X Meldungen oder Verwarnungen; Priorität ist nur ein Hinweis.

### Offen [O]
- Wer der neuen Regel-Fassung nicht zustimmt, kann die App weiter nutzen (Fenster bei jedem Start). Sperren der
  Nutzung bis zur Zustimmung nur auf Wunsch.
- Ältere Sperren (vor #150) haben keinen Einspruchs-Link; Einsprüche dazu per Mail.
- Wirkung am iPhone (Passwort-Abfrage mit Schlüsselbund, Mails) prüft der Nutzer im TestFlight-Bau 16.
