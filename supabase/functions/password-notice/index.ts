// Fangpunkt – einmalige Hinweis-Mail an Konten aus der Zeit der Code-Anmeldung (Wunsch Nutzer 2026-11-10):
// „Fangpunkt meldet ab jetzt mit E-Mail und Passwort an – so legst du dein Passwort fest.“ Kein Konto wird gelöscht
// oder geändert, außer dem Vermerk `app_metadata.password_notice_at` (damit niemand die Mail doppelt bekommt).
//
// Aufruf nur aus dem Moderationsbereich (Mehr → Moderation → „Hinweis-Mail: Passwort“), mit der Anmeldung eines
// Moderators (JWT-Prüfung an). Body `{ send: false }` zählt nur, `{ send: true }` verschickt.
// Empfänger: bestätigte E-Mail-Adresse, noch ohne Passwort (`user_metadata.has_password` fehlt), noch nicht benachrichtigt.
//
// Geheimnisse wie bei notify-report (Supabase → Edge Functions → Secrets): SMTP_HOST, SMTP_PORT, SMTP_USER
// (noreply@fangpunkt.com), SMTP_PASSWORD. SUPABASE_URL, SUPABASE_ANON_KEY und den geheimen Schlüssel stellt Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.16';

const APP_URL = 'https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/mehr/konto';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // ältere Projekte: nur der bisherige Schlüssel
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // ältere Projekte
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

function transport() {
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
    secure: Number(Deno.env.get('SMTP_PORT') ?? '465') === 465,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });
}

const text = (name: string | undefined) => `Hallo${name ? ` ${name}` : ''},

Fangpunkt meldet dich ab sofort mit deiner E-Mail-Adresse und einem Passwort an. Das ist sicherer als der bisherige Code per E-Mail.

Dein Konto bleibt, wie es ist: Profil, Beiträge, Freunde und geteilte Spots sind weiter da.

So legst du dein Passwort fest:
• Bist du in der App noch angemeldet: Mehr → Konto → „Passwort festlegen“.
• Sonst: Mehr → Konto → „Passwort vergessen?“ und deine E-Mail-Adresse eingeben. Du bekommst dann eine E-Mail mit Link und Code (10 Minuten gültig).

Web-App: ${APP_URL}

Tipp: Lass dein Passwort vom iPhone bzw. Browser speichern, dann musst du es dir nicht merken.

Diese E-Mail wurde automatisch verschickt – bitte nicht darauf antworten. Fragen? kontakt@fangpunkt.com

Petri Heil
Dein Fangpunkt-Team`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'nur POST' }, 405);
  const auth = req.headers.get('authorization') ?? '';
  // Nur Moderatoren: mit der Anmeldung des Aufrufers fragen (is_moderator prüft auth.uid())
  const caller = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(), {
    global: { headers: { authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: isMod, error: modError } = await caller.rpc('is_moderator');
  if (modError || isMod !== true) return reply({ error: 'not_moderator' }, 403);

  let send = false;
  try {
    send = ((await req.json()) as { send?: unknown }).send === true;
  } catch {
    // ohne Body: nur zählen
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), { auth: { persistSession: false } });
  const pending: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return reply({ error: error.message }, 500);
    for (const u of data.users) {
      if (!u.email || !u.email_confirmed_at) continue;
      if (u.user_metadata?.['has_password'] === true) continue;
      if (u.app_metadata?.['password_notice_at']) continue;
      if (u.banned_until && Date.parse(u.banned_until) > Date.now()) continue;
      pending.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 200) break;
  }
  if (!send) return reply({ pending: pending.length, sent: 0, failed: 0 });

  const mailer = transport();
  let sent = 0;
  const failed: string[] = [];
  for (const p of pending) {
    try {
      const { data: profile } = await admin.from('profiles').select('display_name').eq('id', p.id).maybeSingle();
      await mailer.sendMail({
        from: `Fangpunkt <${Deno.env.get('SMTP_USER')}>`,
        to: p.email,
        subject: 'Fangpunkt: Anmeldung jetzt mit Passwort',
        text: text((profile as { display_name?: string } | null)?.display_name),
      });
      await admin.auth.admin.updateUserById(p.id, { app_metadata: { password_notice_at: new Date().toISOString() } });
      sent++;
      // sanft verschicken (Grenzen des Mailpostfachs)
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      failed.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (failed.length) console.error('password-notice', failed.join('; '));
  return reply({ pending: pending.length - sent, sent, failed: failed.length });
});
