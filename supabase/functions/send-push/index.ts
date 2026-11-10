// Fangpunkt – Push-Mitteilung an Apple (APNs) schicken (Wunsch Nutzer 2026-11-04, Entscheidung: direkt über Apple).
// Ausgelöst von public.enqueue_push (pg_net) mit nur der ID einer Zeile aus push_outbox. Aus dem Aufruf wird nichts
// übernommen außer der ID: Text, Empfänger und Geräte liest die Funktion selbst, und jede Zeile wird höchstens
// einmal verschickt (sent_at). Deshalb braucht der Aufruf keinen Schlüssel (JWT-Prüfung aus).
//
// Geheimnisse (Supabase → Edge Functions → Secrets):
//   APNS_KEY_ID      – Key ID des Push-Schlüssels (Apple Developer → Keys, „Apple Push Notifications service“)
//   APNS_TEAM_ID     – Team ID
//   APNS_PRIVATE_KEY – Inhalt der .p8-Datei (mit BEGIN/END-Zeilen)
//   APNS_HOST        – optional; Standard api.push.apple.com (TestFlight und App Store)
// SUPABASE_URL und der geheime Schlüssel kommen von Supabase selbst – nie ins Repo.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const TOPIC = 'com.fangpunkt.app';

type Kind =
  | 'friend_request'
  | 'friend_accepted'
  | 'like'
  | 'comment'
  | 'spot'
  | 'session_invite'
  | 'new_post'
  | 'comment_reply'
  | 'session_joined'
  | 'session_highlight'
  | 'test';

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    if (keys.default) return keys.default;
  } catch {
    // ältere Projekte: nur der bisherige Schlüssel
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

/** Text und Ziel in der App je Art */
function message(kind: Kind, name: string, ref: string | null, excerpt: string | null) {
  switch (kind) {
    case 'friend_request':
      return { title: 'Neue Freundschaftsanfrage', body: `${name} möchte mit dir befreundet sein.`, path: '/profil/freunde' };
    case 'friend_accepted':
      return { title: 'Anfrage angenommen', body: `${name} hat deine Freundschaftsanfrage angenommen.`, path: '/profil/freunde' };
    case 'like':
      return { title: 'Gefällt mir', body: `${name} gefällt dein Beitrag.`, path: `/profil/beitrag/${ref ?? ''}` };
    case 'comment':
      return { title: 'Neuer Kommentar', body: excerpt ? `${name}: ${excerpt}` : `${name} hat deinen Beitrag kommentiert.`, path: `/profil/beitrag/${ref ?? ''}` };
    case 'spot':
      return { title: 'Neuer Spot', body: excerpt ? `${name} hat einen Spot mit dir geteilt: ${excerpt}` : `${name} hat einen Spot mit dir geteilt.`, path: '/profil/spots' };
    case 'session_invite':
      return { title: 'Einladung zum Angeln', body: excerpt ? `${name} lädt dich zur Session „${excerpt}“ ein.` : `${name} lädt dich zu einer gemeinsamen Session ein.`, path: '/fangbuch/sessions' };
    case 'new_post':
      return { title: 'Neuer Beitrag', body: excerpt ? `${name}: ${excerpt}` : `${name} hat einen neuen Beitrag geteilt.`, path: '/feed' };
    case 'comment_reply':
      return { title: 'Neuer Kommentar', body: excerpt ? `${name} hat auch kommentiert: ${excerpt}` : `${name} hat einen Beitrag kommentiert, den du auch kommentiert hast.`, path: '/feed' };
    case 'session_joined':
      return { title: 'Zusage zur Session', body: excerpt ? `${name} ist bei „${excerpt}“ dabei.` : `${name} ist bei deiner gemeinsamen Session dabei.`, path: '/fangbuch/sessions' };
    case 'session_highlight':
      return { title: 'Neues Highlight', body: excerpt ? `${name} hat ein Highlight aus „${excerpt}“ geteilt.` : `${name} hat ein Highlight aus eurer Session geteilt.`, path: '/fangbuch/sessions' };
    case 'test':
      return { title: 'Fangpunkt', body: 'Test-Mitteilung: Mitteilungen kommen auf diesem iPhone an. 🎣', path: '/feed' };
  }
}

// Apple-Anmeldung: JWT (ES256), höchstens 1 h gültig – hier je Aufruf neu und 50 min zwischengespeichert
let cachedJwt: { token: string; at: number } | undefined;
const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function apnsJwt(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60_000) return cachedJwt.token;
  const pem = (Deno.env.get('APNS_PRIVATE_KEY') ?? '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID') }));
  const claims = b64url(JSON.stringify({ iss: Deno.env.get('APNS_TEAM_ID'), iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`));
  cachedJwt = { token: `${header}.${claims}.${b64url(sig)}`, at: Date.now() };
  return cachedJwt.token;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('nur POST', { status: 405 });
  let id: unknown;
  try {
    id = ((await req.json()) as { id?: unknown }).id;
  } catch {
    return new Response('ungültig', { status: 400 });
  }
  if (typeof id !== 'string') return new Response('ungültig', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), { auth: { persistSession: false } });
  // Zeile „beanspruchen“: nur ein Aufruf verschickt sie
  const { data: row, error } = await db
    .from('push_outbox')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', id)
    .is('sent_at', null)
    .select('id, user_id, kind, actor, ref, excerpt')
    .maybeSingle();
  if (error) return new Response('Datenbankfehler', { status: 500 });
  if (!row) return new Response('schon verschickt oder unbekannt', { status: 200 });

  const { data: actor } = await db.from('profiles').select('display_name').eq('id', row.actor).maybeSingle();
  const { data: devices } = await db.from('push_devices').select('token').eq('user_id', row.user_id);
  const msg = message(row.kind as Kind, actor?.display_name ?? 'Jemand', row.ref, row.excerpt);
  const host = Deno.env.get('APNS_HOST') || 'api.push.apple.com';

  let jwt: string;
  try {
    jwt = await apnsJwt();
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    await db.from('push_outbox').update({ error: `Schlüssel: ${text}`.slice(0, 500) }).eq('id', row.id);
    console.error('APNs-Schlüssel unbrauchbar', text);
    return new Response('Schlüssel unbrauchbar', { status: 500 });
  }

  const problems: string[] = [];
  for (const d of devices ?? []) {
    const res = await fetch(`https://${host}/3/device/${d.token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': TOPIC,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: { alert: { title: msg.title, body: msg.body }, sound: 'default', 'thread-id': row.kind },
        path: msg.path,
      }),
    });
    if (res.ok) continue;
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? String(res.status);
    // Gerät gibt es nicht mehr (App gelöscht) → Token entfernen
    if (res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered')
      await db.from('push_devices').delete().eq('token', d.token);
    problems.push(`${res.status} ${reason}`);
  }
  if (problems.length) {
    await db.from('push_outbox').update({ error: problems.join('; ').slice(0, 500) }).eq('id', row.id);
    console.error('APNs-Fehler', problems.join('; '));
  }
  return new Response(problems.length ? `teilweise: ${problems.join('; ')}` : 'ok', { status: 200 });
});
