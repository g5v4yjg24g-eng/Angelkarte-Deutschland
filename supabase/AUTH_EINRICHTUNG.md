# Anmeldung mit E-Mail und Passwort – Einrichtung in Supabase

Stand 2026-11-10 (Wunsch Nutzer: „richtige Anmeldemaske“, Bestätigungslink, Passwort vergessen, E-Mail ändern,
Codes 10 Minuten gültig). Die App ruft nur noch `signInWithPassword`, `signUp`, `resetPasswordForEmail`,
`updateUser` und `verifyOtp` (Typ `signup`/`recovery`) auf – die Code-Anmeldung (`signInWithOtp`) gibt es nicht mehr.
Bestehende Konten bleiben unverändert; sie legen ihr Passwort über „Passwort festlegen“ (noch angemeldet) oder
„Passwort vergessen?“ fest. Bezeichnungen der Menüpunkte können sich in Supabase leicht ändern **[A]**.

**Reihenfolge:** erst alle Einstellungen unten, dann den PR mergen (Web-App) bzw. den neuen TestFlight-Bau.

## 1. Authentication → Sign In / Providers → Email

| Einstellung | Wert |
|---|---|
| Enable Email provider | an (ist es schon) |
| Confirm email | **an** – neue Konten erst nach Link/Code aktiv |
| Secure email change | **an** – Bestätigung an alte *und* neue Adresse |
| Secure password change | aus – die App fragt das aktuelle Passwort selbst ab |
| Minimum password length | **10** (gleiche Grenze wie in der App) |
| Password requirements | keine Pflicht-Zeichenarten (die App prüft auf leicht zu erratende Passwörter) |
| Email OTP Expiration | **600** Sekunden (= 10 Minuten; gilt für Codes *und* Links) |
| Email OTP Length | 6 |
| Leaked password protection | nicht verfügbar im kostenlosen Tarif – aus lassen |

## 2. Authentication → URL Configuration

- **Site URL:** `https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/`
- **Redirect URLs:** dieselbe Adresse eintragen (Links aus den Mails führen dorthin; in der iPhone-App gilt der Code).

## 3. Authentication → Emails → Templates

Absender bleibt `noreply@fangpunkt.com` (SMTP Settings unverändert). Jeweils Betreff und Text ersetzen.

### Confirm sign up
Betreff: `Fangpunkt: Bitte bestätige deine E-Mail-Adresse`
```html
<h2>Willkommen bei Fangpunkt!</h2>
<p>Bitte bestätige deine E-Mail-Adresse, damit dein Konto aktiv wird:</p>
<p><a href="{{ .ConfirmationURL }}">E-Mail-Adresse bestätigen</a></p>
<p>Oder gib in der App diesen Code ein: <strong style="font-size:20px;letter-spacing:2px">{{ .Token }}</strong></p>
<p>Link und Code gelten 10 Minuten. Hast du dich nicht bei Fangpunkt registriert, ignoriere diese E-Mail einfach.</p>
<p>Diese E-Mail wurde automatisch verschickt – bitte nicht antworten.</p>
```

### Reset password
Betreff: `Fangpunkt: Passwort festlegen`
```html
<h2>Passwort festlegen</h2>
<p>Für dein Fangpunkt-Konto wurde ein neues Passwort angefragt. Tippe auf den Link:</p>
<p><a href="{{ .ConfirmationURL }}">Neues Passwort festlegen</a></p>
<p>Oder gib in der App diesen Code ein: <strong style="font-size:20px;letter-spacing:2px">{{ .Token }}</strong></p>
<p>Link und Code gelten 10 Minuten. Warst du das nicht? Dann ignoriere diese E-Mail – dein Passwort bleibt, wie es ist.</p>
<p>Diese E-Mail wurde automatisch verschickt – bitte nicht antworten.</p>
```

### Change email address
Betreff: `Fangpunkt: Neue E-Mail-Adresse bestätigen`
```html
<h2>E-Mail-Adresse ändern</h2>
<p>Für dein Fangpunkt-Konto wurde die Änderung von {{ .Email }} auf {{ .NewEmail }} angefragt.</p>
<p><a href="{{ .ConfirmationURL }}">Änderung bestätigen</a></p>
<p>Die Änderung gilt erst, wenn sie an beiden Adressen bestätigt ist. Der Link gilt 10 Minuten.</p>
<p>Warst du das nicht? Dann bestätige nichts und ändere dein Passwort in der App (Mehr → Konto → Sicherheit).</p>
<p>Diese E-Mail wurde automatisch verschickt – bitte nicht antworten.</p>
```

### Magic link
Wird nicht mehr verwendet – kann bleiben, wie es ist.

## 4. Authentication → Emails → Security notifications

Einschalten und Texte setzen:

**Password changed** – Betreff `Fangpunkt: Dein Passwort wurde geändert`
```html
<p>Das Passwort deines Fangpunkt-Kontos ({{ .Email }}) wurde gerade geändert.</p>
<p>Warst du das nicht? Lege sofort über „Passwort vergessen?“ ein neues fest und melde dich bei kontakt@fangpunkt.com.</p>
```

**Email address changed** – Betreff `Fangpunkt: Deine E-Mail-Adresse wurde geändert`
```html
<p>Die E-Mail-Adresse deines Fangpunkt-Kontos wurde von {{ .OldEmail }} auf {{ .Email }} geändert.</p>
<p>Warst du das nicht? Melde dich bitte sofort bei kontakt@fangpunkt.com.</p>
```

## 5. Edge Function `password-notice` (einmalige Hinweis-Mail an bestehende Konten)

1. Edge Functions → **Deploy a new function** → Name `password-notice`, Inhalt aus
   `supabase/functions/password-notice/index.ts`. **Verify JWT: an** (nur angemeldete Moderatoren dürfen aufrufen).
2. Die SMTP-Secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) gibt es schon (notify-report).
3. Nach dem Update der Web-App bzw. App: Mehr → Moderation → ganz unten „Hinweis-Mail: Anmeldung mit Passwort“ →
   „Empfänger zählen“ → „An N Konten senden“. Jedes Konto bekommt sie höchstens einmal
   (`app_metadata.password_notice_at`); Konten mit Passwort und gesperrte Konten bekommen sie nicht.

## 6. Zustellung (DKIM/SPF/DMARC)

Ohne DKIM landen Bestätigungs- und Passwort-Mails eher im Spam – jetzt wichtiger, weil man ohne die Mail nicht
weiterkommt. INWX schreibt, dass es DKIM in den Zusatzprodukten „Mailspace“ und „Webspace“ **nicht** anbietet
**[O: beim INWX-Support nachfragen, ob das für das Postfach noreply@fangpunkt.com gilt]**. Mindestens:
- **SPF** für fangpunkt.com prüfen (TXT-Eintrag mit dem Absender-Server von INWX).
- **DMARC** anlegen: TXT `_dmarc.fangpunkt.com` = `v=DMARC1; p=none;` (nur beobachten, nichts blockieren).
- Gibt es bei INWX kein DKIM: Ausweichen auf einen Versanddienst mit DKIM (z. B. Brevo, kostenloses Kontingent) –
  neue Entscheidung nötig (neuer Fremdserver, Datenschutzseite).
