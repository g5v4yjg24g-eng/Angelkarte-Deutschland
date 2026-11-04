# Moderationsbereich in der App (Plan, Variante A)

Entscheidung Nutzer 2026-11-04: **Variante A** – versteckter Moderationsbereich in der App statt SQL-Befehlen.
Status: **[O] geplant, noch nicht gebaut.** **Pflicht vor dem nächsten Upload zu Apple** (TestFlight/App Store):
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

## Entscheidungen Nutzer (2026-11-04)
- **Sperren zeitlich begrenzt und dauerhaft:** Auswahl beim Sperren (z. B. 1 Tag, 7 Tage, 30 Tage, dauerhaft);
  befristete Sperren enden von selbst (`until`), Anzeige der Restdauer im Moderationsbereich.
- **Mail an die gesperrte Person:** beim Sperren (mit Dauer und Grund) und beim Aufheben – über das vorhandene
  Postfach noreply@fangpunkt.com (Edge Function wie `notify-report`, Vorlage in Deutsch, Kontakt
  moderation@fangpunkt.com für Einspruch).
- **Sperre rückgängig machen:** „Sperre aufheben“ jederzeit (z. B. bei Versehen) – stellt Anmeldung und
  Sichtbarkeit der Inhalte sofort wieder her. Deshalb **beim Sperren nichts löschen**, Inhalte nur ausblenden;
  Löschen bleibt eine eigene, bewusste Aktion („Inhalt löschen“). Jede Sperre/Aufhebung steht im Protokoll.
