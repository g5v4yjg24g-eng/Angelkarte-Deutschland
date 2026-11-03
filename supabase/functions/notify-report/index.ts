// Fangpunkt – E-Mail an moderation@fangpunkt.com bei jeder neuen Meldung (Etappe 5, Entscheidung Nutzer 2026-11-03).
// Ausgelöst vom Trigger `reports_notify` (pg_net, *_moderation.sql) mit nur der Meldungs-ID. Der Aufruf braucht
// keinen Schlüssel (JWT-Prüfung aus), denn die Funktion übernimmt nichts aus dem Aufruf außer der ID: Sie liest die
// Meldung selbst aus der Datenbank und schickt nur, solange `notified_at` leer ist. So kann niemand über einen
// eigenen Aufruf Mails mit eigenem Inhalt oder doppelt auslösen.
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
const KINDS: Record<string, string> = { post: 'Beitrag', spot: 'Geteilter Spot', user: 'Konto' };

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // ältere Projekte: nur der bisherige Schlüssel
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('nur POST', { status: 405 });
  let id: unknown;
  try {
    id = ((await req.json()) as { record?: { id?: unknown } }).record?.id;
  } catch {
    return new Response('ungültig', { status: 400 });
  }
  if (typeof id !== 'string') return new Response('ungültig', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), { auth: { persistSession: false } });
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
    'Bitte innerhalb von 24 Stunden prüfen. Erledigt: im SQL-Editor',
    `update public.reports set status = 'done' where id = '${report.id}';`,
  ].join('\n');

  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'),
    port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
    secure: Number(Deno.env.get('SMTP_PORT') ?? '465') === 465,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASSWORD') },
  });
  try {
    await transport.sendMail({
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
