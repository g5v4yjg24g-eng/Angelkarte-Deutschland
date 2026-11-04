// Fangpunkt – E-Mail an moderation@fangpunkt.com bei jeder neuen Meldung (Etappe 5, Entscheidung Nutzer 2026-11-03).
// Ausgelöst vom Trigger `reports_notify` (pg_net, *_moderation.sql) mit nur der Meldungs-ID. Der Aufruf braucht
// keinen Schlüssel (JWT-Prüfung aus), denn die Funktion übernimmt nichts aus dem Aufruf außer der ID: Sie liest die
// Meldung selbst aus der Datenbank und schickt nur, solange `notified_at` leer ist. So kann niemand über einen
// eigenen Aufruf Mails mit eigenem Inhalt oder doppelt auslösen.
//
// Außerdem (Moderationsbereich, Entscheidung Nutzer 2026-11-04): Aufruf mit `{ ban_event: <id> }` aus mod_ban /
// mod_unban → Mail an die gesperrte Person bei Sperre und bei Aufhebung (Zeile in ban_events, `notified_at`).
//
// Geheimnisse (Supabase → Edge Functions → Secrets), dieselben Werte wie unter Authentication → SMTP Settings:
//   SMTP_HOST, SMTP_PORT (z. B. 465), SMTP_USER (noreply@fangpunkt.com), SMTP_PASSWORD
// SUPABASE_URL und den geheimen Schlüssel (SUPABASE_SECRET_KEYS bzw. früher SUPABASE_SERVICE_ROLE_KEY) stellt
// Supabase selbst bereit – sie stehen nie im Repo.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.16';

const TO = 'moderation@fangpunkt.com';
const REASONS: Record<string, string> = {
  spam: 'Spam oder Werbung',
  abuse: 'Beleidigung, Bedrohung oder Hass',
  nudity: 'Nacktheit oder sexuelle Inhalte',
  violence: 'Gewalt oder Tierquälerei',
  privacy: 'Daten anderer ohne Zustimmung',
  other: 'Sonstiges',
};
const APP_URL = 'https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland';
const KINDS: Record<string, string> = { post: 'Beitrag', spot: 'Geteilter Spot', user: 'Konto', comment: 'Kommentar' };

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // ältere Projekte: nur der bisherige Schlüssel
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function transport() {
  return nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
    secure: Number(Deno.env.get('SMTP_PORT') ?? '465') === 465,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });
}

type Db = ReturnType<typeof createClient>;

/** Mail an die gesperrte Person (Sperre oder Aufhebung) – höchstens einmal je Ereignis */
async function banMail(db: Db, eventId: string): Promise<Response> {
  const { data: ev, error } = await db
    .from('ban_events')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('notified_at', null)
    .select('id, user_id, kind, until, reason')
    .maybeSingle();
  if (error) return new Response('Datenbankfehler', { status: 500 });
  if (!ev) return new Response('schon verschickt oder unbekannt', { status: 200 });
  const { data: u } = await db.auth.admin.getUserById(ev.user_id as string);
  const email = u?.user?.email;
  if (!email) return new Response('keine Adresse', { status: 200 });
  const until = ev.until
    ? new Date(ev.until as string).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' })
    : null;
  const ban = ev.kind === 'ban';
  const subject = ban ? 'Dein Fangpunkt-Konto ist gesperrt' : 'Dein Fangpunkt-Konto ist wieder freigeschaltet';
  const text = ban
    ? [
        'Hallo,',
        '',
        until
          ? `dein Konto bei Fangpunkt ist bis zum ${until} gesperrt.`
          : 'dein Konto bei Fangpunkt ist dauerhaft gesperrt.',
        `Grund: ${ev.reason ?? '–'}`,
        '',
        'Solange die Sperre gilt, kannst du dich nicht anmelden und deine Beiträge, Kommentare und geteilten Spots sind für andere nicht sichtbar. Gelöscht wurde dabei nichts. Dein Fangbuch auf deinem Gerät ist davon nicht betroffen.',
        '',
        'Wenn du glaubst, dass das ein Irrtum ist, antworte nicht auf diese Mail, sondern schreib an moderation@fangpunkt.com.',
        '',
        'Die Regeln der Community: https://fangpunkt.com/datenschutz/#regeln',
        '',
        'Fangpunkt',
      ].join('\n')
    : [
        'Hallo,',
        '',
        'die Sperre deines Fangpunkt-Kontos ist aufgehoben. Du kannst dich wieder anmelden, und deine Inhalte sind wieder sichtbar.',
        '',
        'Fangpunkt',
      ].join('\n');
  try {
    await transport().sendMail({ from: `Fangpunkt <${Deno.env.get('SMTP_USER')}>`, to: email, subject, text });
  } catch (e) {
    await db.from('ban_events').update({ notified_at: null }).eq('id', ev.id);
    console.error('Mailversand fehlgeschlagen', e instanceof Error ? e.message : e);
    return new Response('Mailversand fehlgeschlagen', { status: 502 });
  }
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('nur POST', { status: 405 });
  let id: unknown;
  let banEvent: unknown;
  try {
    const payload = (await req.json()) as { record?: { id?: unknown }; ban_event?: unknown };
    id = payload.record?.id;
    banEvent = payload.ban_event;
  } catch {
    return new Response('ungültig', { status: 400 });
  }
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), { auth: { persistSession: false } });
  if (typeof banEvent === 'string') return banMail(db, banEvent);
  if (typeof id !== 'string') return new Response('ungültig', { status: 400 });
  // Meldung „beanspruchen“: nur ein Aufruf verschickt die Mail
  const { data: report, error } = await db
    .from('reports')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id)
    .is('notified_at', null)
    .select('id, reporter, target_type, target_id, target_user, reason, details, created_at')
    .maybeSingle();
  if (error) return new Response('Datenbankfehler', { status: 500 });
  if (!report) return new Response('schon gemeldet oder unbekannt', { status: 200 });

  const names = new Map<string, string>();
  const ids = [report.reporter, report.target_user].filter((x): x is string => !!x);
  const { data: profiles } = await db.from('profiles').select('id, username, display_name').in('id', ids);
  for (const p of profiles ?? []) names.set(p.id, `${p.display_name} (@${p.username})`);
  let content = '';
  if (report.target_type === 'post') {
    const { data: post } = await db.from('posts').select('caption, photo_paths').eq('id', report.target_id).maybeSingle();
    content = post
      ? `Text: ${post.caption ?? '–'}\nFotos (Speicher post-photos): ${(post.photo_paths as string[]).join(', ')}`
      : 'Beitrag ist nicht mehr vorhanden.';
  } else if (report.target_type === 'spot') {
    const { data: spot } = await db.from('shared_spots').select('name, note').eq('id', report.target_id).maybeSingle();
    content = spot ? `Name: ${spot.name ?? '–'}\nNotiz: ${spot.note ?? '–'}` : 'Spot ist nicht mehr geteilt.';
  } else if (report.target_type === 'comment') {
    const { data: c } = await db.from('post_comments').select('body, post_id').eq('id', report.target_id).maybeSingle();
    content = c ? `Kommentar: ${c.body}\nZu Beitrag: ${c.post_id}` : 'Kommentar ist nicht mehr vorhanden.';
  }

  const text = [
    `Neue Meldung in Fangpunkt (${new Date(report.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})`,
    '',
    `Art: ${KINDS[report.target_type] ?? report.target_type}`,
    `Grund: ${REASONS[report.reason] ?? report.reason}`,
    `Hinweis der meldenden Person: ${report.details ?? '–'}`,
    `Gemeldet von: ${names.get(report.reporter) ?? report.reporter}`,
    `Betroffenes Konto: ${report.target_user ? (names.get(report.target_user) ?? report.target_user) : '–'}`,
    `Ziel-ID: ${report.target_id}`,
    content ? `\n${content}` : '',
    '',
    `Meldungs-ID: ${report.id}`,
    'Bitte innerhalb von 24 Stunden prüfen – in der App unter Mehr → Moderation:',
    `${APP_URL}/mehr/moderation/${report.id}`,
  ].join('\n');

  try {
    await transport().sendMail({
      from: `Fangpunkt <${Deno.env.get('SMTP_USER')}>`,
      to: TO,
      subject: `Meldung: ${KINDS[report.target_type] ?? report.target_type} – ${REASONS[report.reason] ?? report.reason}`,
      text,
    });
  } catch (e) {
    // Versand fehlgeschlagen: wieder freigeben, damit ein erneuter Aufruf es nachholt
    await db.from('reports').update({ notified_at: null }).eq('id', report.id);
    console.error('Mailversand fehlgeschlagen', e instanceof Error ? e.message : e);
    return new Response('Mailversand fehlgeschlagen', { status: 502 });
  }
  return new Response('ok', { status: 200 });
});
