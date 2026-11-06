import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from './fixtures';
import type { Locator } from '@playwright/test';
import { collectErrors, screenPoint, serveWaterFixture, tapRendered, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const SUPABASE = 'https://sgnyymciwnwjgvojptwu.supabase.co';
/** 1×1-PNG für Fotos aus dem Speicher */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const EXP = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', exp: EXP, role: 'authenticated', aud: 'authenticated', email: 'max@example.de' })}.sig`;

/** Nachgebildeter Supabase-Server: Auth (Code) und REST (profiles, Funktionen) – der echte wird nie gerufen. */
type FakeFriend = {
  request_id: string;
  user_id: string;
  username: string;
  display_name: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  badges: string[];
  since: string;
};

async function fakeSupabase(
  page: Page,
  badges: string[] = [],
  friends: FakeFriend[] = [],
  feed: unknown[] = [],
  spots: Record<string, unknown>[] = [],
) {
  const calls: string[] = [];
  const reports: Record<string, unknown>[] = [];
  const blocks: { user_id: string; username: string; display_name: string }[] = [];
  // Gefällt mir / Kommentare (Wunsch Nutzer 2026-11-04): je Beitrag Anzahl fremder Likes, eigener Like, Kommentare
  const likes = new Map<string, { others: number; mine: boolean }>();
  // Moderationsbereich: vom Test vorher befüllt
  const mod = {
    moderator: false,
    reports: [] as Record<string, unknown>[],
    content: new Map<string, Record<string, unknown>>(),
    users: new Map<string, Record<string, unknown>>(),
    log: [] as { action: string; who: unknown; detail: unknown }[],
  };
  const comments: {
    id: string;
    post_id: string;
    author_id: string;
    username: string;
    display_name: string;
    badges: string[];
    body: string;
    created_at: string;
  }[] = [];
  const storage = new Map<string, number>();
  // Profilbilder (Paket 2b): Nutzer-ID → Pfad im Speicher „avatars“
  const avatars = new Map<string, string>();
  // Lesezeichen (Paket 7b): gespeicherte Beitrags-IDs in Reihenfolge des Speicherns
  const saves: string[] = [];
  // Gemeinsame Sessions (Paket 8a): Sessions aus Sicht von u-1, Teilnehmer je Session, Antworten
  type GroupMemberRow = {
    user_id: string;
    username: string;
    display_name: string;
    status: string;
    is_host: boolean;
  };
  const group = {
    sessions: [] as Record<string, unknown>[],
    members: new Map<string, GroupMemberRow[]>(),
    responses: [] as { session: string; accept: boolean }[],
    ended: [] as string[],
    left: [] as string[],
  };
  const posts = new Map<
    string,
    { id: string; caption: string | null; visibility: string; photo_paths: string[] }
  >();
  let profile: { id: string; username: string; display_name: string } | null = null;
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'max@example.de' };
  const exp = EXP;
  const token = TOKEN;
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    calls.push(key);
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    // Feed (Etappe 3): zeitlich begrenzte Foto-Adressen und die Fotos selbst
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      if (req.method() === 'POST') {
        const { paths } = req.postDataJSON() as { paths: string[] };
        return json(
          route,
          paths.map((path) => ({ path, signedURL: `/object/sign/post-photos/${path}?token=t`, error: null })),
        );
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    // Fotospeicher (Etappe 2): hochladen, auflisten, löschen
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const rest = url.pathname.slice('/storage/v1/object/'.length);
      if (req.method() === 'POST' && rest.startsWith('list/')) {
        const { prefix: folder } = req.postDataJSON() as { prefix: string };
        // Profilbilder liegen mit Speichernamen davor, Beitragsfotos ohne
        const prefix = rest === 'list/avatars' ? `avatars/${folder}` : folder;
        const names = [...storage.keys()]
          .filter((k) => k.startsWith(`${prefix}/`))
          .map((k) => k.slice(prefix.length + 1).split('/')[0] as string);
        return json(
          route,
          [...new Set(names)].map((name) => ({ name })),
        );
      }
      if (req.method() === 'POST' || req.method() === 'PUT') {
        storage.set(rest.replace(/^post-photos\//, ''), (req.postDataBuffer() ?? Buffer.alloc(0)).length);
        return json(route, { Key: rest });
      }
      if (req.method() === 'DELETE') {
        const { prefixes } = req.postDataJSON() as { prefixes: string[] };
        prefixes.forEach((k) => storage.delete(rest === 'avatars' ? `avatars/${k}` : k));
        return json(route, []);
      }
    }
    if (url.pathname === '/rest/v1/posts') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (req.method() === 'POST') {
        const b = req.postDataJSON() as {
          id: string;
          caption: string | null;
          visibility: string;
          photo_paths: string[];
        };
        posts.set(b.id, b);
        return route.fulfill({ status: 201 });
      }
      if (req.method() === 'PATCH' && id) {
        const b = req.postDataJSON() as { caption: string | null; visibility: string };
        const cur = posts.get(id);
        if (cur) posts.set(id, { ...cur, ...b });
        return route.fulfill({ status: 204 });
      }
      if (req.method() === 'DELETE' && id) {
        posts.delete(id);
        return route.fulfill({ status: 204 });
      }
    }
    switch (key) {
      case 'POST /auth/v1/otp':
        return json(route, {});
      case 'POST /auth/v1/verify': {
        const body = req.postDataJSON() as { token: string };
        if (body.token !== '123456')
          return json(
            route,
            { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
            403,
          );
        return json(route, {
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: exp,
          refresh_token: 'r-1',
          user,
        });
      }
      case 'GET /auth/v1/user':
        return json(route, user);
      case 'POST /auth/v1/logout':
        return route.fulfill({ status: 204 });
      case 'GET /rest/v1/profiles':
        return json(route, single ? profile : profile ? [profile] : []);
      case 'POST /rest/v1/rpc/username_available': {
        const { name } = req.postDataJSON() as { name: string };
        return json(route, name !== 'hecht');
      }
      case 'POST /rest/v1/profiles': {
        const b = req.postDataJSON() as { id: string; username: string; display_name: string };
        profile = { id: b.id, username: b.username, display_name: b.display_name };
        return json(route, single ? profile : [profile], 201);
      }
      case 'PATCH /rest/v1/profiles': {
        const b = req.postDataJSON() as { display_name: string };
        profile = { ...(profile as NonNullable<typeof profile>), display_name: b.display_name };
        return json(route, single ? profile : [profile]);
      }
      case 'GET /rest/v1/user_badges':
        return json(
          route,
          badges.map((badge) => ({ badge })),
        );
      case 'POST /rest/v1/rpc/feed':
        return json(
          route,
          feed.filter((p) => !(p as { stranger?: boolean }).stranger),
        );
      case 'POST /rest/v1/rpc/discover_feed':
        return json(
          route,
          feed.filter((p) => (p as { visibility?: string }).visibility === 'public'),
        );
      case 'POST /rest/v1/rpc/my_friends':
        return json(route, friends);
      case 'POST /rest/v1/rpc/send_friend_request': {
        const { name } = req.postDataJSON() as { name: string };
        if (name === 'gibtsnicht') return json(route, { code: 'P0001', message: 'not_found' }, 400);
        const back = friends.find((f) => f.username === name && f.direction === 'incoming');
        if (back) {
          back.status = 'accepted';
          return json(route, 'accepted');
        }
        friends.push({
          request_id: `r-${name}`,
          user_id: `u-${name}`,
          username: name,
          display_name: name,
          status: 'pending',
          direction: 'outgoing',
          badges: [],
          since: '2026-11-04T10:00:00Z',
        });
        return json(route, 'sent');
      }
      case 'POST /rest/v1/rpc/respond_friend_request': {
        const { request, accept } = req.postDataJSON() as { request: string; accept: boolean };
        const i = friends.findIndex((f) => f.request_id === request);
        if (accept) (friends[i] as FakeFriend).status = 'accepted';
        else friends.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/remove_friend': {
        const { other } = req.postDataJSON() as { other: string };
        friends.splice(
          friends.findIndex((f) => f.user_id === other),
          1,
        );
        return route.fulfill({ status: 204 });
      }
      // Spots teilen (Etappe 4)
      case 'POST /rest/v1/rpc/my_shared_spots':
        return json(route, spots);
      case 'POST /rest/v1/rpc/share_spot': {
        const b = req.postDataJSON() as Record<string, unknown>;
        const friend = friends.find((f) => f.user_id === b.recipient);
        if (b.recipient && friend?.status !== 'accepted')
          return json(route, { code: 'P0001', message: 'not_friends' }, 400);
        const old = spots.findIndex(
          (x) =>
            x.direction === 'outgoing' && x.place_id === b.place && (x.recipient_id ?? null) === b.recipient,
        );
        const row = {
          id: old >= 0 ? spots[old]?.id : `s-${spots.length + 1}`,
          place_id: b.place,
          direction: 'outgoing',
          owner_id: 'u-1',
          owner_username: profile?.username ?? '',
          owner_display_name: profile?.display_name ?? '',
          owner_badges: badges,
          recipient_id: b.recipient ?? null,
          recipient_username: friend?.username ?? null,
          recipient_display_name: friend?.display_name ?? null,
          place_type: b.kind,
          name: b.spot_name ?? null,
          note: b.spot_note ?? null,
          lat: b.spot_lat,
          lng: b.spot_lng,
          updated_at: new Date().toISOString(),
        };
        if (old >= 0) spots[old] = row;
        else spots.push(row);
        return json(route, row.id);
      }
      case 'POST /rest/v1/rpc/unshare_spot': {
        const { spot } = req.postDataJSON() as { spot: string };
        const i = spots.findIndex((x) => x.id === spot && x.direction === 'outgoing');
        if (i >= 0) spots.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
      // Melden/Blockieren (Etappe 5)
      case 'POST /rest/v1/rpc/report_content':
        reports.push(req.postDataJSON() as Record<string, unknown>);
        return json(route, `r-${reports.length}`);
      case 'POST /rest/v1/rpc/block_user': {
        const { other } = req.postDataJSON() as { other: string };
        const f = friends.find((x) => x.user_id === other);
        blocks.push({
          user_id: other,
          username: f?.username ?? other,
          display_name: f?.display_name ?? other,
        });
        if (f) friends.splice(friends.indexOf(f), 1);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/unblock_user': {
        const { other } = req.postDataJSON() as { other: string };
        blocks.splice(
          blocks.findIndex((b) => b.user_id === other),
          1,
        );
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/my_blocks':
        return json(route, blocks);
      case 'POST /rest/v1/rpc/post_reactions': {
        const { posts: ids } = req.postDataJSON() as { posts: string[] };
        return json(
          route,
          ids.map((id) => {
            const l = likes.get(id) ?? { others: 0, mine: false };
            return {
              post_id: id,
              like_count: l.others + (l.mine ? 1 : 0),
              liked: l.mine,
              comment_count: comments.filter((c) => c.post_id === id).length,
            };
          }),
        );
      }
      case 'POST /rest/v1/rpc/toggle_like': {
        const { post } = req.postDataJSON() as { post: string };
        const l = likes.get(post) ?? { others: 0, mine: false };
        likes.set(post, { ...l, mine: !l.mine });
        return json(route, !l.mine);
      }
      case 'POST /rest/v1/rpc/post_comment_list': {
        const { post } = req.postDataJSON() as { post: string };
        const owner = feed.find((x) => (x as { id: string }).id === post) as
          { author_id: string } | undefined;
        return json(
          route,
          comments
            .filter((c) => c.post_id === post)
            .map((c) => ({
              ...c,
              can_delete: c.author_id === 'u-1' || owner?.author_id === 'u-1' || !owner,
            })),
        );
      }
      case 'POST /rest/v1/rpc/add_comment': {
        const { post, body } = req.postDataJSON() as { post: string; body: string };
        comments.push({
          id: `c-${comments.length + 1}`,
          post_id: post,
          author_id: 'u-1',
          username: profile?.username ?? '',
          display_name: profile?.display_name ?? '',
          badges,
          body,
          created_at: new Date(Date.now() + comments.length).toISOString(),
        });
        return json(route, `c-${comments.length}`);
      }
      case 'POST /rest/v1/rpc/delete_comment': {
        const { comment } = req.postDataJSON() as { comment: string };
        const i = comments.findIndex((c) => c.id === comment);
        if (i >= 0) comments.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
      // Moderationsbereich
      case 'POST /rest/v1/rpc/is_moderator':
        return json(route, mod.moderator);
      case 'POST /rest/v1/rpc/mod_reports': {
        if (!mod.moderator) return json(route, { code: 'P0001', message: 'not_moderator' }, 400);
        const { state } = req.postDataJSON() as { state: string };
        return json(
          route,
          mod.reports.filter((r) => state === 'all' || r.status === state),
        );
      }
      case 'POST /rest/v1/rpc/mod_content': {
        const { target } = req.postDataJSON() as { target: string };
        const c = mod.content.get(target);
        return json(route, c ? [c] : []);
      }
      case 'POST /rest/v1/rpc/mod_user': {
        const { who } = req.postDataJSON() as { who: string };
        const u = mod.users.get(who);
        return json(route, u ? [u] : []);
      }
      case 'POST /rest/v1/rpc/mod_user_content':
        return json(route, []);
      case 'POST /rest/v1/rpc/mod_user_log': {
        const { who } = req.postDataJSON() as { who: string };
        return json(
          route,
          mod.log
            .filter((l) => l.who === who)
            .map((l) => ({
              action: l.action,
              detail: l.detail,
              created_at: '2026-11-05T12:00:00Z',
              moderator_name: 'Kevin',
            })),
        );
      }
      case 'POST /rest/v1/rpc/mod_delete_content': {
        const b = req.postDataJSON() as { kind: string; target: string; note: string | null };
        const c = mod.content.get(b.target);
        mod.content.delete(b.target);
        mod.log.push({ action: `delete_${b.kind}`, who: c?.author, detail: b.note });
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/mod_warn': {
        const b = req.postDataJSON() as { who: string; note: string };
        mod.log.push({ action: 'warn', who: b.who, detail: b.note });
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/mod_resolve': {
        const b = req.postDataJSON() as { report: string; note: string | null };
        const r = mod.reports.find((x) => x.id === b.report);
        if (r) r.status = 'done';
        mod.log.push({ action: 'resolve', who: r?.target_user, detail: b.note });
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/mod_ban': {
        const b = req.postDataJSON() as { who: string; days: number | null; reason: string };
        const u = mod.users.get(b.who);
        if (u) {
          u.banned = true;
          u.ban_until = b.days === null ? null : new Date(Date.now() + b.days * 86_400_000).toISOString();
          u.ban_reason = b.reason;
        }
        mod.reports.forEach((r) => r.target_user === b.who && (r.target_banned = true));
        mod.log.push({ action: 'ban', who: b.who, detail: `${b.days ?? 'dauerhaft'}: ${b.reason}` });
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/mod_unban': {
        const b = req.postDataJSON() as { who: string; note: string | null };
        const u = mod.users.get(b.who);
        if (u) {
          u.banned = false;
          u.ban_until = null;
          u.ban_reason = null;
        }
        mod.reports.forEach((r) => r.target_user === b.who && (r.target_banned = false));
        mod.log.push({ action: 'unban', who: b.who, detail: b.note });
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/toggle_save': {
        const { post } = req.postDataJSON() as { post: string };
        const i = saves.indexOf(post);
        if (i >= 0) saves.splice(i, 1);
        else saves.unshift(post);
        return json(route, i < 0);
      }
      case 'POST /rest/v1/rpc/my_saved_ids': {
        const { posts } = req.postDataJSON() as { posts: string[] };
        return json(
          route,
          posts.filter((p) => saves.includes(p)),
        );
      }
      case 'POST /rest/v1/rpc/saved_posts':
        return json(
          route,
          saves
            .map((id) => (feed as { id: string }[]).find((p) => p.id === id))
            .filter(Boolean)
            .map((p) => ({ ...p, saved_at: '2026-11-08T10:00:00Z' })),
        );
      case 'POST /rest/v1/rpc/avatar_paths': {
        const { users } = req.postDataJSON() as { users: string[] };
        return json(
          route,
          users.filter((u) => avatars.has(u)).map((u) => ({ user_id: u, avatar_path: avatars.get(u) })),
        );
      }
      case 'POST /rest/v1/rpc/set_my_avatar': {
        const { path } = req.postDataJSON() as { path: string | null };
        if (!profile) return json(route, { code: 'P0001', message: 'no_profile' }, 400);
        if (path && !storage.has(`avatars/${path}`))
          return json(route, { code: 'P0001', message: 'invalid_path' }, 400);
        const old = avatars.get(user.id) ?? null;
        if (path) avatars.set(user.id, path);
        else avatars.delete(user.id);
        return json(route, old);
      }
      case 'POST /rest/v1/rpc/mod_clear_avatar': {
        const b = req.postDataJSON() as { who: string; note: string | null };
        const old = avatars.get(b.who) ?? null;
        avatars.delete(b.who);
        mod.log.push({ action: 'delete_avatar', who: b.who, detail: b.note });
        return json(route, old);
      }
      case 'POST /rest/v1/rpc/create_group_session': {
        const body = req.postDataJSON() as { title: string | null; water_name: string | null };
        const id = `g-${group.sessions.length + 1}`;
        group.sessions.push({
          id,
          host_id: 'u-1',
          title: body.title,
          water_name: body.water_name,
          my_status: 'joined',
        });
        group.members.set(id, [
          { user_id: 'u-1', username: 'kevin', display_name: 'Kevin', status: 'joined', is_host: true },
        ]);
        return json(route, id);
      }
      case 'POST /rest/v1/rpc/invite_to_group_session': {
        const { session, users } = req.postDataJSON() as { session: string; users: string[] };
        const list = group.members.get(session) ?? [];
        for (const u of users) {
          const f = friends.find((x) => x.user_id === u);
          if (f)
            list.push({
              user_id: u,
              username: f.username,
              display_name: f.display_name,
              status: 'invited',
              is_host: false,
            });
        }
        group.members.set(session, list);
        return json(route, users.length);
      }
      case 'POST /rest/v1/rpc/group_highlights': {
        const { session } = req.postDataJSON() as { session: string };
        return json(
          route,
          feed.filter((p) => (p as { group_session_id?: string }).group_session_id === session),
        );
      }
      case 'POST /rest/v1/rpc/my_group_sessions':
        return json(
          route,
          group.sessions.filter((g) => 'host_username' in g),
        );
      case 'POST /rest/v1/rpc/group_session_members_list': {
        const { session } = req.postDataJSON() as { session: string };
        return json(route, group.members.get(session) ?? []);
      }
      case 'POST /rest/v1/rpc/respond_group_invite': {
        const body = req.postDataJSON() as { session: string; accept: boolean };
        group.responses.push(body);
        const me = group.members.get(body.session)?.find((m) => m.user_id === 'u-1');
        if (me) me.status = body.accept ? 'joined' : 'declined';
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/leave_group_session': {
        const { session } = req.postDataJSON() as { session: string };
        group.left.push(session);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/end_group_session': {
        const { session } = req.postDataJSON() as { session: string };
        group.ended.push(session);
        return route.fulfill({ status: 204 });
      }
      case 'POST /rest/v1/rpc/delete_my_account':
        profile = null;
        return route.fulfill({ status: 204 });
      default:
        return json(route, { message: `nicht nachgebildet: ${key}` }, 404);
    }
  });
  // nicht aufzählbar, damit `expect(calls).toEqual([...])` nur die Aufrufe vergleicht
  return Object.defineProperties(calls, {
    storage: { value: storage },
    posts: { value: posts },
    spots: { value: spots },
    reports: { value: reports },
    blocks: { value: blocks },
    likes: { value: likes },
    comments: { value: comments },
    mod: { value: mod },
    avatars: { value: avatars },
    saves: { value: saves },
    group: { value: group },
  }) as string[] & {
    group: typeof group;
    saves: typeof saves;
    avatars: typeof avatars;
    mod: typeof mod;
    likes: typeof likes;
    comments: typeof comments;
    reports: typeof reports;
    blocks: typeof blocks;
    storage: typeof storage;
    posts: typeof posts;
    spots: typeof spots;
  };
}

test('ACC-3: Konto anlegen mit E-Mail-Code, Profil, Anzeigename ändern, Konto löschen', async ({ page }) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /^Konto.*Freiwillig/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  expect(calls).toEqual([]); // ohne Anmeldung kein Kontakt zu Supabase

  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('Max@Example.de');
  // Regeln der Community vor dem Code (Wunsch Nutzer 2026-11-03): Ablehnen verschickt nichts
  await page.getByRole('button', { name: 'Code senden' }).click();
  const rules = page.getByRole('dialog', { name: 'Regeln der Community' });
  await expect(rules.getByText('Kein Spam und keine Werbung.')).toBeVisible();
  await rules.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByText(/Es wurde keine E-Mail verschickt/)).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByRole('button', { name: 'Code senden' }).click();
  await rules.getByRole('button', { name: 'Akzeptieren' }).click();
  await expect(page.getByText(/Code an max@example\.de geschickt/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('999999');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText(/Der Code ist falsch oder abgelaufen/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('123456');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await expect(page.getByRole('heading', { name: 'Profil anlegen' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('hecht');
  await expect(page.getByText('Dieser Nutzername ist schon vergeben.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('zander.max');
  await expect(page.getByText('Frei.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Max');
  await page.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByText('@zander.max')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
      .then((r) =>
        r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
      ),
  ).toEqual([]);

  // Anmeldung bleibt nach dem Neuladen erhalten; Mehr zeigt „Angemeldet“
  await page.goto('/mehr');
  await expect(page.getByRole('link', { name: /^Konto.*Angemeldet/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByText('@zander.max')).toBeVisible();

  await page.getByRole('button', { name: 'Anzeigename ändern' }).click();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Max M.');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Max M.')).toBeVisible();

  await page.getByRole('textbox', { name: /deinen Nutzernamen „zander.max“ eingeben/ }).fill('zander.max');
  await page.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await expect(page.getByText('Dein Konto wurde gelöscht.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
  expect(calls).toContain('POST /rest/v1/rpc/delete_my_account');
  // keine Fangdaten an Supabase (beim Löschen werden nur die eigenen Beitragsfotos aufgelistet)
  expect(
    calls.every((c) =>
      /\/(auth\/v1|storage\/v1\/object\/list\/(post-photos|avatars)|rest\/v1\/(profiles|user_badges|rpc\/(username_available|delete_my_account|my_friends|is_moderator|avatar_paths)))/.test(
        c,
      ),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('fangpunkt.auth'))).toBeNull();
  // erwartet: die Antwort 403 auf den absichtlich falschen Code
  expect(errors.filter((e) => !e.includes('status of 403'))).toEqual([]);
});

test('ACC-4: Übergangslösung – Anmelde-Link aus der Standard-Mail meldet an, abgelaufener Link wird erklärt', async ({
  page,
}) => {
  const calls = await fakeSupabase(page);
  await page.goto(
    `/#access_token=${TOKEN}&expires_at=${EXP}&expires_in=3600&refresh_token=r-1&token_type=bearer&type=magiclink`,
  );
  await waitForApp(page);
  await expect(page).toHaveURL(/\/mehr\/konto#?$/);
  await expect(page.getByRole('heading', { name: 'Profil anlegen' })).toBeVisible();
  expect(calls).toContain('GET /auth/v1/user');
  expect(await page.evaluate(() => location.hash)).toBe('');

  await page.evaluate(() => localStorage.removeItem('fangpunkt.auth'));
  await page.goto(
    '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );
  await waitForApp(page);
  await expect(page).toHaveURL(/\/mehr\/konto$/);
  await expect(page.getByText(/Der Anmelde-Link ist abgelaufen/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
});

test('ACC-5: Konto freigeschaltet – Mehr → Konto zeigt das Anmeldeformular, ohne vorher Supabase zu fragen', async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route('https://sgnyymciwnwjgvojptwu.supabase.co/**', (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  await page.goto('/mehr');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /^Konto.*Freiwillig/ })).toBeVisible();
  await page.getByRole('link', { name: /^Konto/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeVisible();
  await expect(page.getByText(/Demnächst/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Ohne Eingabe keine Anfrage an Supabase
  expect(calls).toEqual([]);
});

/** Anmelden und Profil anlegen (gemeinsam für die Abzeichen-Tests) */
async function signInWithProfile(page: Page, username: string) {
  await page.goto('/mehr/konto');
  await waitForApp(page);
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('max@example.de');
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page
    .getByRole('dialog', { name: 'Regeln der Community' })
    .getByRole('button', { name: 'Akzeptieren' })
    .click();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('123456');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill(username);
  await expect(page.getByText('Frei.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Anzeigename' }).fill('Kevin');
  await page.getByRole('button', { name: 'Profil speichern' }).click();
  await expect(page.getByText(`@${username}`)).toBeVisible();
}

async function jpeg(page: Page) {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    ctx.fillStyle = '#2d9cdb';
    ctx.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  });
  return { name: 'fang.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

const founderBadge = (page: Page | Locator) => page.getByRole('img', { name: /Abzeichen: Founder/ });

test('BADGE-3: FOUNDER vom Server – im Konto, auf dem Profil (groß), am Beitrag und am Kommentar (klein)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(page, ['founder']);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await expect(founderBadge(page)).toBeVisible();
  await expect(page.getByText('FOUNDER')).toBeVisible();

  await page.goto('/profil');
  await waitForApp(page);
  await expect(founderBadge(page)).toBeVisible();
  await expect(page.getByText('FOUNDER')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(founderBadge(page).first()).toBeVisible();

  await page.getByRole('button', { name: 'Kommentieren' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await sheet.getByLabel('Kommentar hinzufügen').fill('Petri Heil!');
  await sheet.getByLabel('Kommentar hinzufügen').press('Enter');
  await expect(sheet.getByText('Petri Heil!')).toBeVisible();
  await expect(founderBadge(sheet)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('BADGE-4: normales Konto ohne Abzeichen – auch ein manipulierter Speicher ändert das nicht', async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await signInWithProfile(page, 'max');
  await expect(founderBadge(page)).toHaveCount(0);

  // Abzeichen im Gerätespeicher selbst eintragen: der Server sagt beim nächsten Start „keins“
  await page.evaluate(() =>
    localStorage.setItem(
      'fangpunkt.badges',
      JSON.stringify({ userId: 'u-1', badges: ['founder'], checkedAt: 1 }),
    ),
  );
  await page.goto('/profil');
  await waitForApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(founderBadge(page)).toHaveCount(0);
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('fangpunkt.badges'))) ?? '{}'),
  ).toMatchObject({
    userId: 'u-1',
    badges: [],
  });

  // abmelden: gemerkte Abzeichen werden vergessen
  await page.goto('/mehr/konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByText('Du bist abgemeldet.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fangpunkt.badges'))).toBeNull();
});

test('FRD-2: Freunde – Anfrage annehmen, senden, zurückziehen, entfernen; Zahl im Profil', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(
    page,
    [],
    [
      {
        request_id: 'r-anna',
        user_id: 'u-anna',
        username: 'anna',
        display_name: 'Anna',
        status: 'pending',
        direction: 'incoming',
        badges: ['founder'],
        since: '2026-11-04T09:00:00Z',
      },
    ],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/profil');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Freunde hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Freunde' })).toBeVisible();
  await expect(page.getByText('Dein Nutzername: @kevin')).toBeVisible();

  const incoming = page.getByRole('region', { name: 'Anfragen an dich' });
  await expect(incoming.getByText('Anna', { exact: true })).toBeVisible();
  await expect(incoming.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await incoming.getByRole('button', { name: 'Annehmen' }).click();
  await expect(page.getByText('Du und @anna seid jetzt befreundet.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Deine Freunde (1)' }).getByText('@anna')).toBeVisible();

  await page.getByRole('textbox', { name: 'Nutzername' }).fill('gibtsnicht');
  await page.getByRole('button', { name: 'Anfrage senden' }).click();
  await expect(page.getByText('Diesen Nutzernamen gibt es nicht.', { exact: false })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nutzername' }).fill('@Zander');
  await page.getByRole('button', { name: 'Anfrage senden' }).click();
  await expect(page.getByText('Anfrage an @zander gesendet.')).toBeVisible();
  const outgoing = page.getByRole('region', { name: 'Gesendete Anfragen' });
  await expect(outgoing.getByText('@zander')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await outgoing.getByRole('button', { name: 'Zurückziehen' }).click();
  await expect(page.getByRole('region', { name: 'Gesendete Anfragen' })).toHaveCount(0);

  await page.goto('/profil');
  await expect(page.getByText('1', { exact: true }).locator('xpath=..')).toContainText('Freunde');
  await page.goto('/profil/freunde');
  const friendsList = page.getByRole('region', { name: 'Deine Freunde (1)' });
  await friendsList.getByRole('button', { name: 'Entfernen' }).click();
  await friendsList.getByRole('button', { name: 'Ja, entfernen' }).click();
  await expect(page.getByRole('region', { name: 'Deine Freunde (0)' })).toBeVisible();
  // erwartet: die Antwort 400 auf den unbekannten Nutzernamen
  expect(errors.filter((e) => !e.includes('status of 400'))).toEqual([]);
});

test('FRD-3: Freunde ohne Anmeldung – Hinweis aufs Konto, keine Anfrage an Supabase', async ({ page }) => {
  const calls = await fakeSupabase(page);
  await page.goto('/profil/freunde');
  await waitForApp(page);
  await expect(page.getByText(/Für Freunde brauchst du ein Konto/)).toBeVisible();
  await page.getByRole('link', { name: 'Zum Konto' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
  expect(calls).toEqual([]);
});

test('PST-3: Beitrag teilen – angemeldet wird er mit Fotos hochgeladen, Änderungen folgen, „Nicht mehr teilen“ entfernt ihn', async ({
  page,
}) => {
  const server = await fakeSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  await page.goto('/profil/neu');
  await waitForApp(page);
  await expect(page.getByText(/Wird mit deinem Konto geteilt/)).toBeVisible();
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await page.getByLabel('Text').fill('Hecht vom Steg');
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Geteilt' })).toBeVisible();
  // der Abgleich läuft im Hintergrund (PostSync): auf den Server-Stand warten statt sofort zu prüfen
  await expect
    .poll(() => [...server.posts.values()])
    .toEqual([expect.objectContaining({ caption: 'Hecht vom Steg', visibility: 'friends' })]);
  expect([...server.storage.keys()]).toEqual([expect.stringMatching(/^u-1\/[0-9a-f-]+\/1\.jpg$/)]);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Text').fill('Hecht vom Steg, 92 cm');
  // das Formular ist länger geworden (Fischart/Länge): erst hinscrollen, sonst liegt die Leiste darüber
  await page.getByRole('radio', { name: 'Alle' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.getByRole('radio', { name: 'Alle' }).check({ force: true });
  await expect(page.getByText(/auch für Fremde unter Feed → Entdecken/)).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => [...server.posts.values()][0]?.caption).toBe('Hecht vom Steg, 92 cm');
  expect([...server.posts.values()][0]?.visibility).toBe('public');

  await page.getByRole('button', { name: 'Nicht mehr teilen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nur auf diesem Gerät' })).toBeVisible();
  await expect.poll(() => server.posts.size).toBe(0);
  expect(server.storage.size).toBe(0);
  await page.getByRole('button', { name: 'Teilen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Geteilt' })).toBeVisible();
  await expect.poll(() => server.posts.size).toBe(1);
});

test('PST-4: ohne Anmeldung bleibt ein neuer Beitrag auf dem Gerät', async ({ page }) => {
  const server = await fakeSupabase(page);
  await page.goto('/profil/neu');
  await waitForApp(page);
  await expect(page.getByText(/Ohne Konto bleibt der Beitrag nur auf diesem Gerät/)).toBeVisible();
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Nur auf diesem Gerät' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teilen' })).toHaveCount(0);
  expect(server).toEqual([]);
});

const feedRow = (o: Record<string, unknown>) => ({
  id: '11111111-1111-4111-8111-111111111111',
  author_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  badges: [],
  caption: 'Zander am Abend',
  visibility: 'friends',
  photo_paths: ['u-anna/p1/1.jpg', 'u-anna/p1/2.jpg'],
  created_at: '2026-11-06T18:00:00+00:00',
  ...o,
});

test('FEED-2: Feed in der Leiste – Beiträge von Freunden mit Fotos, Name, Abzeichen und Text', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(
    page,
    [],
    [],
    [
      feedRow({}),
      feedRow({
        id: '22222222-2222-4222-8222-222222222222',
        author_id: 'u-1',
        username: 'kevin',
        display_name: 'Kevin',
        badges: ['founder'],
        caption: null,
        photo_paths: ['u-1/p2/1.jpg'],
        created_at: '2026-11-05T08:00:00+00:00',
      }),
    ],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(nav.getByRole('link')).toHaveText(['Karte', 'Fangbuch', 'Feed', 'Profil', 'Wetter', 'Mehr']);
  await nav.getByRole('link', { name: 'Feed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible();

  const anna = page.getByRole('article', { name: /^Beitrag von Anna/ });
  await expect(anna.getByText('Zander am Abend')).toBeVisible();
  await expect(anna.getByRole('list', { name: 'Fotos von Anna' }).getByRole('listitem')).toHaveCount(2);
  await expect(anna.locator('img').first()).toHaveJSProperty('naturalWidth', 1);
  const own = page.getByRole('article', { name: /^Beitrag von Kevin/ });
  await expect(own.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await expect(page.getByText('Das waren alle Beiträge.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('FEED-3: leerer Feed führt zu „Freunde hinzufügen“; ohne Anmeldung Hinweis und keine Anfrage', async ({
  page,
}) => {
  const calls = await fakeSupabase(page);
  await page.goto('/feed');
  await waitForApp(page);
  await expect(page.getByText(/Dafür brauchst du ein Konto/)).toBeVisible();
  expect(calls).toEqual([]);

  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  await page.getByRole('link', { name: 'Freunde hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Freunde' })).toBeVisible();
});

const ANNA: FakeFriend = {
  request_id: 'r-anna',
  user_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  status: 'accepted',
  direction: 'incoming',
  badges: ['founder'],
  since: '2026-11-04T09:00:00Z',
};
const BUHNE = {
  id: 's-anna-1',
  place_id: 'anna-place-1',
  direction: 'incoming',
  owner_id: 'u-anna',
  owner_username: 'anna',
  owner_display_name: 'Anna',
  owner_badges: ['founder'],
  recipient_id: null,
  recipient_username: null,
  recipient_display_name: null,
  place_type: 'spot',
  name: 'Buhne 3',
  note: 'Zander abends',
  lat: 51.3283,
  lng: 6.2448,
  updated_at: '2026-11-07T08:00:00Z',
};

/** Karte ohne Fremdabrufe: Teststil statt OpenFreeMap, keine Gewässerdaten (Tipp ins Leere legt einen Ort an) */
async function localMap(page: Page) {
  await serveWaterFixture(page, { missing: true });
  await page.route('https://tiles.openfreemap.org/**', (r) =>
    r.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('fangpunkt.mapView', JSON.stringify({ lng: 6.2418, lat: 51.3263, zoom: 15 }));
  });
}

test('SPOT-3: Spots teilen – Spot von Anna auf der Karte übernehmen, eigenen Ort teilen, Teilen beenden', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [], [{ ...BUHNE }]);
  await localMap(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });

  // Kartenfilter: Spots von Freunden lassen sich aus- und wieder einblenden
  const sharedCount = () =>
    page.evaluate(() => {
      const src = window.__fangpunktMap?.getSource('fp-places') as
        { serialize?: () => { data?: unknown } } | undefined;
      const fc = src?.serialize?.().data as { features?: { properties?: { entity?: string } }[] } | undefined;
      return (fc?.features ?? []).filter((f) => f.properties?.entity === 'shared').length;
    });
  await expect.poll(sharedCount).toBe(1);
  await page.getByRole('button', { name: 'Ebenen & Legende' }).click();
  const layers = page.getByRole('dialog', { name: 'Ebenen & Legende' });
  await layers.getByRole('checkbox', { name: /^Spots von Freunden/ }).uncheck();
  await expect.poll(sharedCount).toBe(0);
  await layers.getByRole('checkbox', { name: /^Spots von Freunden/ }).check();
  await expect.poll(sharedCount).toBe(1);
  await page.keyboard.press('Escape');

  // Spot von Anna: violetter Pin (Spitze unten → etwas oberhalb tippen)
  await tapRendered(page, 'fp-places', 6.2448, 51.3283, -14);
  const shared = page.getByRole('dialog', { name: 'Geteilter Spot' });
  await expect(shared.getByText('Buhne 3')).toBeVisible();
  await expect(shared.getByText(/von Anna/)).toBeVisible();
  await expect(shared.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  await expect(shared.getByText('Zander abends')).toBeVisible();
  await shared.getByRole('button', { name: 'In meine Orte übernehmen' }).click();
  await expect(page.getByText('Zu deinen Orten hinzugefügt.')).toBeVisible();
  const adopted = page.getByRole('dialog', { name: 'Angelstelle' });
  await expect(adopted.getByText('Geteilt von Anna (@anna)', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');

  // eigenen Ort anlegen und teilen
  const p = await screenPoint(page, 6.2418, 51.3253);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Angelsteg' })
    .click();
  const form = page.getByRole('dialog', { name: 'Angelsteg anlegen' });
  await form.getByLabel('Bezeichnung (optional)').fill('Steg am Schilf');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await tapRendered(page, 'fp-places', 6.2418, 51.3253);
  await page.getByRole('dialog', { name: 'Angelsteg' }).getByRole('button', { name: 'Teilen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Spot teilen' })).toBeVisible();
  await expect(page.getByText('Steg am Schilf')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Alle Freunde/ })).toBeChecked();
  await page.getByRole('button', { name: 'Teilen', exact: true }).click();
  await expect(page.getByText('Geteilt an alle Freunde.')).toBeVisible();
  await page.getByRole('radio', { name: /Anna/ }).check();
  await page.getByRole('button', { name: 'Teilen', exact: true }).click();
  await expect(page.getByText('Geteilt an Anna.')).toBeVisible();
  const current = page.getByRole('region', { name: 'Bereits geteilt' });
  await expect(current.getByText('an alle Freunde')).toBeVisible();
  await expect(current.getByText('an Anna')).toBeVisible();
  // genau die gespeicherte Position, nur Art/Name/Position
  const out = calls.spots.filter((x) => x.direction === 'outgoing');
  expect(out).toHaveLength(2);
  const local = await page.evaluate(
    () =>
      new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        const open = indexedDB.open('fangpunkt');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('places').objectStore('places').getAll();
          req.onsuccess = () => {
            const rows = req.result as { name?: string; position: { lat: number; lng: number } }[];
            const hit = rows.find((x) => x.name === 'Steg am Schilf');
            if (hit) resolve(hit.position);
            else reject(new Error('Ort fehlt'));
          };
        };
      }),
  );
  expect(out[0]).toMatchObject({
    place_type: 'jetty',
    name: 'Steg am Schilf',
    note: null,
    lat: local.lat,
    lng: local.lng,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await current
    .getByRole('listitem')
    .filter({ hasText: 'an alle Freunde' })
    .getByRole('button', { name: 'Nicht mehr teilen' })
    .click();
  await expect(page.getByText('Wird nicht mehr geteilt.')).toBeVisible();
  await expect(current.getByText('an alle Freunde')).toHaveCount(0);

  // Übersicht im Profil
  await page.goto('/profil');
  await page.getByRole('button', { name: 'Geteilte Spots' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Geteilte Spots' })).toBeVisible();
  const incoming = page.getByRole('region', { name: 'Mit dir geteilt' });
  await expect(incoming.getByText('Buhne 3')).toBeVisible();
  await expect(incoming.getByRole('button', { name: 'In deinen Orten' })).toBeDisabled();
  const mine = page.getByRole('region', { name: 'Von dir geteilt' });
  await expect(mine.getByText('Steg am Schilf')).toBeVisible();
  await expect(mine.getByText(/an Anna/)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await incoming.getByRole('button', { name: 'Auf der Karte' }).click();
  await expect(page.getByRole('dialog', { name: 'Geteilter Spot' }).getByText('Buhne 3')).toBeVisible();
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test('SPOT-4: ohne Anmeldung – Hinweis aufs Konto, keine Anfrage an Supabase', async ({ page }) => {
  const calls = await fakeSupabase(page);
  await localMap(page);
  await page.goto('/profil/spots');
  await waitForApp(page);
  await expect(page.getByText(/Zum Teilen von Spots brauchst du ein Konto/)).toBeVisible();
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
  await page.goto('/profil/spots/teilen/irgendwas');
  await expect(page.getByText(/Zum Teilen von Spots brauchst du ein Konto/)).toBeVisible();
  expect(calls).toEqual([]);
});

const FEED_ANNA = {
  id: 'post-anna-1',
  author_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  badges: [],
  caption: 'Zander am Abend',
  visibility: 'friends',
  photo_paths: ['u-anna/post-anna-1/1.jpg'],
  created_at: '2026-11-07T18:00:00Z',
};

test('MOD-2: Beitrag im Feed melden – Grund wählen, Meldung geht an den Server, Beitrag ist weg', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await waitForApp(page);
  await expect(page.getByText('Zander am Abend')).toBeVisible();
  await page.getByRole('button', { name: 'Optionen zu Anna' }).click();
  const sheet = page.getByRole('dialog', { name: 'Optionen' });
  await sheet.getByRole('button', { name: 'Melden' }).click();
  const report = page.getByRole('dialog', { name: 'Melden' });
  await expect(report.getByText('Was stimmt mit diesem Beitrag nicht?')).toBeVisible();
  await expect(report.getByRole('button', { name: 'Meldung senden' })).toBeDisabled();
  await report.getByRole('radio', { name: 'Spam oder Werbung' }).check();
  await report.getByRole('textbox', { name: 'Hinweis (optional)' }).fill('Werbung für einen Shop');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await report.getByRole('button', { name: 'Meldung senden' }).click();
  await expect(page.getByText(/Wir prüfen die Meldung innerhalb von 24 Stunden/)).toBeVisible();
  await expect(page.getByText('Zander am Abend')).toHaveCount(0);
  expect(calls.reports).toEqual([
    {
      kind: 'post',
      target: 'post-anna-1',
      target_owner: 'u-anna',
      why: 'spam',
      note: 'Werbung für einen Shop',
    },
  ]);
  // bleibt nach dem Neuladen ausgeblendet
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  expect(errors).toEqual([]);
});

test('MOD-3: Freund blockieren und wieder freigeben – Freundschaft endet, Liste „Blockiert“', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/profil/freunde');
  await waitForApp(page);
  const list = page.getByRole('region', { name: 'Deine Freunde (1)' });
  await list.getByRole('button', { name: 'Optionen zu Anna' }).click();
  await page
    .getByRole('dialog', { name: 'Optionen' })
    .getByRole('button', { name: 'Anna blockieren' })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Anna blockieren?' });
  await expect(confirm.getByText(/nicht mehr befreundet/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Blockieren' }).click();
  await expect(page.getByText('Anna ist blockiert.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Deine Freunde (0)' })).toBeVisible();
  const blocked = page.getByRole('region', { name: 'Blockiert' });
  await expect(blocked.getByText('@anna')).toBeVisible();
  expect(calls.blocks.map((b) => b.user_id)).toEqual(['u-anna']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  // Beiträge der blockierten Person sind sofort weg (auch wenn der Server noch einen liefert)
  await page.goto('/feed');
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  await page.goto('/profil/freunde');
  await page.getByRole('region', { name: 'Blockiert' }).getByRole('button', { name: 'Freigeben' }).click();
  await expect(page.getByText('Anna ist nicht mehr blockiert.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Blockiert' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('MOD-4: geteilten Spot melden – auf der Karte und in der Liste ausgeblendet', async ({ page }) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [], [{ ...BUHNE }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/profil/spots');
  await waitForApp(page);
  const incoming = page.getByRole('region', { name: 'Mit dir geteilt' });
  await expect(incoming.getByText('Buhne 3')).toBeVisible();
  await incoming.getByRole('button', { name: 'Optionen zu Anna' }).click();
  await page.getByRole('dialog', { name: 'Optionen' }).getByRole('button', { name: 'Melden' }).click();
  const report = page.getByRole('dialog', { name: 'Melden' });
  await expect(report.getByText('Was stimmt mit diesem Spot nicht?')).toBeVisible();
  await report.getByRole('radio', { name: 'Daten anderer ohne Zustimmung' }).check();
  await report.getByRole('button', { name: 'Meldung senden' }).click();
  await expect(incoming.getByText('Buhne 3')).toHaveCount(0);
  expect(calls.reports).toEqual([
    { kind: 'spot', target: 's-anna-1', target_owner: 'u-anna', why: 'privacy', note: null },
  ]);
  expect(errors).toEqual([]);
});

test('REACT-2: Feed – Daumen hoch und Kommentare bei Annas Beitrag, Annas Kommentar melden', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  calls.likes.set('post-anna-1', { others: 2, mine: false });
  calls.comments.push({
    id: 'c-anna',
    post_id: 'post-anna-1',
    author_id: 'u-anna',
    username: 'anna',
    display_name: 'Anna',
    badges: ['founder'],
    body: 'Bei Sonnenuntergang gefangen',
    created_at: '2026-11-07T18:05:00Z',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await waitForApp(page);
  const card = page.getByRole('article', { name: /Beitrag von Anna/ });
  await expect(card.getByText('2 „Gefällt mir“-Angaben')).toBeVisible();
  await card.getByRole('button', { name: 'Gefällt mir' }).click();
  await expect(card.getByRole('button', { name: 'Gefällt mir' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('3 „Gefällt mir“-Angaben')).toBeVisible();
  await expect.poll(() => calls.likes.get('post-anna-1')?.mine).toBe(true);

  await card.getByRole('button', { name: '1 Kommentar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await expect(sheet.getByText('Bei Sonnenuntergang gefangen')).toBeVisible();
  await expect(sheet.getByRole('img', { name: /Abzeichen: Founder/ })).toBeVisible();
  // fremden Kommentar darf ich nicht löschen, aber melden
  await expect(sheet.getByRole('button', { name: 'Kommentar löschen' })).toHaveCount(0);
  await sheet.getByRole('textbox', { name: 'Kommentar hinzufügen' }).fill('Petri Heil!');
  await sheet.getByRole('button', { name: 'Senden' }).click();
  await expect(sheet.getByText('Petri Heil!')).toBeVisible();
  expect(calls.comments.map((c) => c.body)).toEqual(['Bei Sonnenuntergang gefangen', 'Petri Heil!']);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  // eigenen Kommentar löschen
  await sheet.getByRole('button', { name: 'Kommentar löschen' }).click();
  await expect(sheet.getByText('Petri Heil!')).toHaveCount(0);
  expect(calls.comments.map((c) => c.body)).toEqual(['Bei Sonnenuntergang gefangen']);
  // Annas Kommentar melden
  await sheet.getByRole('button', { name: 'Optionen zu Anna' }).click();
  await page.getByRole('dialog', { name: 'Optionen' }).getByRole('button', { name: 'Melden' }).click();
  const report = page.getByRole('dialog', { name: 'Melden' });
  await expect(report.getByText('Was stimmt mit diesem Kommentar nicht?')).toBeVisible();
  await report.getByRole('radio', { name: 'Spam oder Werbung' }).check();
  await report.getByRole('button', { name: 'Meldung senden' }).click();
  await expect(sheet.getByText('Bei Sonnenuntergang gefangen')).toHaveCount(0);
  expect(calls.reports).toEqual([
    { kind: 'comment', target: 'c-anna', target_owner: 'u-anna', why: 'spam', note: null },
  ]);
  expect(errors).toEqual([]);
});

test('REACT-3: eigener geteilter Beitrag – Gefällt mir und Kommentare kommen vom Server', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  await page.getByLabel('Text').fill('Barsch am Morgen');
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Geteilt' })).toBeVisible();
  await expect(page.getByText(/sehen alle, die diesen Beitrag sehen dürfen/)).toBeVisible();
  const postId = [...calls.posts.keys()][0] ?? '';
  await page.getByRole('button', { name: 'Gefällt mir' }).click();
  await expect.poll(() => calls.likes.get(postId)?.mine).toBe(true);
  await page.getByRole('button', { name: 'Kommentieren' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await sheet.getByRole('textbox', { name: 'Kommentar hinzufügen' }).fill('Schöner Morgen');
  await sheet.getByRole('button', { name: 'Senden' }).click();
  await expect(sheet.getByText('Schöner Morgen')).toBeVisible();
  expect(calls.comments.map((c) => [c.post_id, c.body])).toEqual([[postId, 'Schöner Morgen']]);
  // lokal wurde nichts gespeichert
  const local = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('fangpunkt');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('postComments').objectStore('postComments').count();
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );
  expect(local).toBe(0);
  expect(errors).toEqual([]);
});

test('MODA-2: Moderationsbereich – Meldung ansehen, Inhalt löschen, sperren (7 Tage), Sperre aufheben, erledigt', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }]);
  calls.mod.moderator = true;
  calls.mod.reports.push({
    id: 'r-1',
    target_type: 'comment',
    target_id: 'c-bad',
    reason: 'abuse',
    details: 'Beleidigt andere',
    status: 'open',
    created_at: '2026-11-05T10:00:00Z',
    reporter: 'u-ben',
    reporter_name: 'Ben',
    target_user: 'u-anna',
    target_name: 'Anna',
    target_username: 'anna',
    target_banned: false,
    open_against: 1,
  });
  calls.mod.content.set('c-bad', {
    author: 'u-anna',
    body: 'Du bist ein schlechter Angler',
    photo_paths: null,
    post_id: 'p-1',
    extra: 'Zander am Abend',
    created_at: '2026-11-05T09:00:00Z',
  });
  calls.mod.users.set('u-anna', {
    user_id: 'u-anna',
    username: 'anna',
    display_name: 'Anna',
    banned: false,
    ban_until: null,
    ban_reason: null,
    posts: 1,
    comments: 1,
    spots: 0,
    reports_against: 1,
    joined: '2026-11-01T08:00:00Z',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /^Moderation/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible();
  await page.getByRole('link', { name: /Kommentar: Beleidigung/ }).click();
  await expect(page.getByText('Du bist ein schlechter Angler')).toBeVisible();
  await expect(page.getByText('Beleidigt andere')).toBeVisible();
  await expect(page.getByText('Unter dem Beitrag: „Zander am Abend“')).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Inhalt löschen
  await page.getByRole('button', { name: 'Inhalt löschen' }).click();
  await page
    .getByRole('dialog', { name: 'Inhalt löschen?' })
    .getByRole('button', { name: 'Bestätigen' })
    .click();
  await expect(page.getByText('Dieser Inhalt ist nicht mehr vorhanden', { exact: false })).toBeVisible();

  // Sperren: Grund ist Pflicht, Dauer 7 Tage
  await page.getByRole('button', { name: 'Sperren' }).click();
  const ban = page.getByRole('dialog', { name: 'Anna sperren' });
  await expect(ban.getByRole('radio', { name: '7 Tage' })).toBeChecked();
  await expect(ban.getByRole('button', { name: 'Bestätigen' })).toBeDisabled();
  await ban.getByRole('textbox', { name: /Grund/ }).fill('Beleidigungen');
  await ban.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByText('Gesperrt. Die Person bekommt eine Mail.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sperre aufheben' })).toBeVisible();
  expect(calls.mod.users.get('u-anna')?.banned).toBe(true);

  // Konto-Seite: Sperre mit Restzeit, Protokoll, Aufheben
  await page.getByRole('link', { name: 'Alles von dieser Person ansehen' }).click();
  await expect(page.getByText(/Gesperrt bis/)).toBeVisible();
  const protocol = page.getByRole('region', { name: 'Protokoll' });
  await expect(protocol.getByText('Kommentar gelöscht')).toBeVisible();
  await expect(protocol.getByText('Gesperrt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sperre aufheben' }).click();
  await page
    .getByRole('dialog', { name: 'Sperre von Anna aufheben?' })
    .getByRole('button', { name: 'Bestätigen' })
    .click();
  await expect(page.getByText('Sperre aufgehoben. Die Person bekommt eine Mail.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sperren' })).toBeVisible();
  expect(calls.mod.users.get('u-anna')?.banned).toBe(false);

  // zurück zur Meldung und erledigen
  await page.goto('/mehr/moderation/r-1');
  await page.getByRole('button', { name: 'Meldung erledigt' }).click();
  await page
    .getByRole('dialog', { name: 'Meldung erledigt' })
    .getByRole('button', { name: 'Bestätigen' })
    .click();
  await expect(page.getByText('Meldung als erledigt markiert.')).toBeVisible();
  await page.goto('/mehr/moderation');
  await expect(page.getByText('Keine offenen Meldungen – alles erledigt.')).toBeVisible();
  expect(calls.mod.log.map((l) => l.action)).toEqual(['delete_comment', 'ban', 'unban', 'resolve']);
  expect(errors).toEqual([]);
});

test('MODA-3: ohne Moderatoren-Recht kein Eintrag unter Mehr und kein Zugriff', async ({ page }) => {
  await fakeSupabase(page);
  await signInWithProfile(page, 'kevin');
  await page.goto('/mehr');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /^Konto/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Moderation/ })).toHaveCount(0);
  await page.goto('/mehr/moderation');
  await expect(page.getByText('Diesen Bereich sehen nur Moderatoren.')).toBeVisible();
});

/** Kleines JPEG aus dem Browser */
async function jpegFile(page: Page) {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    ctx.fillStyle = '#1f7a8c';
    ctx.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  });
  return { name: 'ich.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

const avatarKeys = (storage: Map<string, number>) =>
  [...storage.keys()].filter((k) => k.startsWith('avatars/'));

test('AVA-1: Profilbild geht auf den Server – neues ersetzt das alte, Entfernen löscht es; Freunde sehen ihr Bild im Feed', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [], [feedRow({})]);
  calls.avatars.set('u-anna', 'u-anna/0123456789abcdef0123456789abcdef.jpg');
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  // Bild der Freundin im Feed (vom Server, zeitlich begrenzte Adresse)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Feed' }).click();
  const anna = page.getByRole('article', { name: /^Beitrag von Anna/ });
  await expect(anna.locator('header img')).toHaveJSProperty('naturalWidth', 1);

  // Eigenes Bild wählen → hochladen und eintragen
  const choose = async () => {
    await page.goto('/profil/bearbeiten');
    await waitForApp(page);
    await page.getByLabel('Name').fill('Kevin');
    await page.getByLabel('Profilbild wählen').setInputFiles(await jpegFile(page));
    await page
      .getByRole('dialog', { name: 'Profilbild zuschneiden' })
      .getByRole('button', { name: 'Übernehmen' })
      .click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  };
  await choose();
  await expect.poll(() => calls.avatars.get('u-1')).toMatch(/^u-1\/[0-9a-f]{32}\.jpg$/);
  const first = calls.avatars.get('u-1');
  expect(avatarKeys(calls.storage)).toEqual([`avatars/${first}`]);
  expect(calls.storage.get(`avatars/${first}`)).toBeLessThan(1_048_576);

  // Neues Bild: neuer Pfad, altes wird erst danach gelöscht
  await choose();
  await expect.poll(() => calls.avatars.get('u-1')).not.toBe(first);
  await expect.poll(() => avatarKeys(calls.storage)).toEqual([`avatars/${calls.avatars.get('u-1')}`]);

  // Entfernen: auch auf dem Server
  await page.goto('/profil/bearbeiten');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Bild entfernen' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => calls.avatars.has('u-1')).toBe(false);
  // die Datei wird erst nach dem Austragen gelöscht
  await expect.poll(() => avatarKeys(calls.storage)).toEqual([]);
  expect(calls.filter((c) => c.endsWith('/rpc/set_my_avatar'))).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('AVA-2: ohne Server-Profil bleibt das Profilbild auf dem Gerät – kein Fehler, kein Upload-Rest', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page);
  await page.goto('/mehr/konto');
  await waitForApp(page);
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('max@example.de');
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page
    .getByRole('dialog', { name: 'Regeln der Community' })
    .getByRole('button', { name: 'Akzeptieren' })
    .click();
  await page.getByRole('textbox', { name: 'Code aus der E-Mail' }).fill('123456');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('textbox', { name: 'Nutzername' })).toBeVisible();

  await page.goto('/profil/bearbeiten');
  await waitForApp(page);
  await page.getByLabel('Name').fill('Kevin');
  await page.getByLabel('Profilbild wählen').setInputFiles(await jpegFile(page));
  await page
    .getByRole('dialog', { name: 'Profilbild zuschneiden' })
    .getByRole('button', { name: 'Übernehmen' })
    .click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('main').getByRole('img', { name: 'Profilbild' })).toBeVisible();
  await expect.poll(() => calls.filter((c) => c.endsWith('/rpc/set_my_avatar')).length).toBe(1);
  // abgelehnt (kein Server-Profil): hochgeladene Datei wurde wieder entfernt
  await expect.poll(() => avatarKeys(calls.storage)).toEqual([]);
  expect(calls.avatars.size).toBe(0);
  expect(errors.filter((e) => !e.includes('status of 400'))).toEqual([]);
});

test('MODA-4: Moderator entfernt ein unpassendes Profilbild – mit Bestätigung, Datei weg, im Protokoll', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page);
  calls.mod.moderator = true;
  calls.mod.users.set('u-anna', {
    user_id: 'u-anna',
    username: 'anna',
    display_name: 'Anna',
    banned: false,
    ban_until: null,
    ban_reason: null,
    posts: 0,
    comments: 0,
    spots: 0,
    reports_against: 1,
    joined: '2026-11-01T08:00:00Z',
  });
  const path = 'u-anna/0123456789abcdef0123456789abcdef.jpg';
  calls.avatars.set('u-anna', path);
  calls.storage.set(`avatars/${path}`, 1000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/mehr/moderation/nutzer/u-anna');
  await waitForApp(page);
  await expect(page.getByRole('main').getByRole('img', { name: 'Profilbild' })).toHaveJSProperty(
    'naturalWidth',
    1,
  );
  await page.getByRole('button', { name: 'Profilbild entfernen' }).click();
  await expect(page.getByRole('dialog', { name: 'Profilbild entfernen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByText('Profilbild entfernt.')).toBeVisible();
  expect(calls.avatars.has('u-anna')).toBe(false);
  expect(avatarKeys(calls.storage)).toEqual([]);
  expect(calls.mod.log.at(-1)?.action).toBe('delete_avatar');
  await expect(page.getByRole('button', { name: 'Profilbild entfernen' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('FEED-4: Doppeltipp im Feed – Hecht schwimmt zum Daumen, „Gefällt mir“ geht genau einmal an den Server', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  calls.likes.set('post-anna-1', { others: 2, mine: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await waitForApp(page);
  const card = page.getByRole('article', { name: /Beitrag von Anna/ });
  const photo = card.getByRole('listitem').first();
  await expect(card.getByText('2 „Gefällt mir“-Angaben')).toBeVisible();
  await photo.dblclick();
  await photo.dblclick();
  await expect(card.getByRole('button', { name: 'Gefällt mir' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('3 „Gefällt mir“-Angaben')).toBeVisible();
  await page.waitForTimeout(1500);
  await photo.dblclick();
  await page.waitForTimeout(1300);
  expect(calls.filter((c) => c.endsWith('/rpc/toggle_like'))).toHaveLength(1);
  expect(calls.likes.get('post-anna-1')?.mine).toBe(true);
  expect(errors).toEqual([]);
});

test('FEED-5: Fischart und Länge – gehen mit dem Beitrag auf den Server und stehen im Feed', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(
    page,
    [],
    [{ ...ANNA }],
    [
      { ...FEED_ANNA, species_id: 'zander', length_cm: 71 },
      { ...FEED_ANNA, id: 'post-anna-2', created_at: '2026-11-06T18:00:00Z', caption: 'Ohne Angaben' },
    ],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/feed');
  await waitForApp(page);
  await expect(
    page
      .getByRole('article', { name: /Beitrag von Anna/ })
      .first()
      .getByText('Zander · 71 cm'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('article', { name: /Beitrag von Anna/ })
      .nth(1)
      .getByText(/ · \d+ cm|Zander/),
  ).toHaveCount(0);

  // eigener Beitrag mit Fischart und Länge → hochgeladen mit species_id / length_cm
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpegFile(page));
  const info = page.getByRole('group', { name: 'Angaben zum Fang (freiwillig)' });
  await info.getByLabel('Fischart').selectOption({ label: 'Hecht' });
  await info.getByLabel('Länge in cm').fill('92');
  await page.getByRole('button', { name: 'Posten' }).click();
  await expect.poll(() => [...calls.posts.values()].length).toBe(1);
  const sent = [...calls.posts.values()][0] as unknown as { species_id: string; length_cm: number };
  expect(sent.species_id).toBe('pike');
  expect(sent.length_cm).toBe(92);
  expect(errors).toEqual([]);
});

const DISCOVER_OTTO = {
  id: 'post-otto-1',
  author_id: 'u-otto',
  username: 'otto',
  display_name: 'Otto',
  badges: [],
  caption: 'Barsch vom Boot',
  visibility: 'public',
  photo_paths: ['u-otto/post-otto-1/1.jpg'],
  created_at: '2026-10-01T08:00:00Z',
  shared_at: '2026-11-08T09:00:00Z',
  stranger: true,
};

test('DISC-1: Entdecken – Reiter im Feed zeigt öffentliche Beiträge anderer, leerer Zustand', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA, DISCOVER_OTTO]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  await page.goto('/feed');
  await waitForApp(page);
  await expect(page.getByRole('article', { name: /Beitrag von Anna/ })).toBeVisible();
  await expect(page.getByRole('article', { name: /Beitrag von Otto/ })).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Feed-Ansicht' })
    .getByRole('link', { name: 'Entdecken' })
    .click();
  await expect(page).toHaveURL(/\/feed\/entdecken$/);
  const otto = page.getByRole('article', { name: /Beitrag von Otto/ });
  await expect(otto.getByText('Barsch vom Boot')).toBeVisible();
  await expect(page.getByRole('article', { name: /Beitrag von Anna/ })).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Feed' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('DISC-1: Entdecken ohne öffentliche Beiträge zeigt den leeren Zustand', async ({ page }) => {
  await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  await signInWithProfile(page, 'kevin');
  await page.goto('/feed/entdecken');
  await waitForApp(page);
  await expect(page.getByText('Noch nichts zu entdecken')).toBeVisible();
});

const BEN: FakeFriend = {
  request_id: 'r-ben',
  user_id: 'u-ben',
  username: 'ben',
  display_name: 'Ben',
  status: 'accepted',
  direction: 'outgoing',
  badges: [],
  since: '2026-11-05T09:00:00Z',
};

test('GRP-1: Freunde zur Session einladen – gemeinsame Session wird angelegt, Teilnehmer erscheinen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }, { ...BEN }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Session starten' }).first().click();
  await expect(page.getByRole('heading', { name: 'Gemeinsam angeln' })).toBeVisible();
  await page.getByRole('button', { name: 'Freunde einladen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Freunde einladen' })).toBeVisible();
  await expect(page.getByText('Noch 9 Plätze frei.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('checkbox', { name: /Anna/ }).check();
  await expect(page.getByText('Noch 8 Plätze frei.')).toBeVisible();
  await page.getByRole('button', { name: '1 Person einladen' }).click();

  // zurück in der Session: Gastgeber und Eingeladene
  const members = page.getByRole('list', { name: 'Dabei' });
  await expect(members.getByText('Kevin (du)')).toBeVisible();
  await expect(members.getByText('@anna · eingeladen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weitere einladen' })).toBeVisible();
  expect(calls.group.sessions).toHaveLength(1);
  expect(calls.group.members.get('g-1')?.map((m) => m.user_id)).toEqual(['u-1', 'u-anna']);

  // Beenden der eigenen Session beendet als Gastgeber auch die gemeinsame
  await page.getByRole('button', { name: 'Session beenden' }).click();
  await expect.poll(() => [...calls.group.ended]).toEqual(['g-1']);
  expect(errors).toEqual([]);
});

test('GRP-2: Einladung annehmen startet eine eigene Session, Verlassen löst nur die Verknüpfung', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }]);
  calls.group.sessions.push({
    id: 'g-anna',
    host_id: 'u-anna',
    host_username: 'anna',
    host_display_name: 'Anna',
    title: 'Abendansitz',
    water_name: null,
    started_at: '2026-11-06T16:00:00Z',
    ended_at: null,
    my_status: 'invited',
    joined_count: 1,
  });
  calls.group.members.set('g-anna', [
    { user_id: 'u-anna', username: 'anna', display_name: 'Anna', status: 'joined', is_host: true },
    { user_id: 'u-1', username: 'kevin', display_name: 'Kevin', status: 'invited', is_host: false },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await expect(page.getByText('Anna lädt dich zum gemeinsamen Angeln ein')).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Zusagen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Abendansitz' })).toBeVisible();
  await expect(page.getByText('Session läuft').first()).toBeVisible();
  const members = page.getByRole('list', { name: 'Dabei' });
  await expect(members.getByText('@anna · lädt ein')).toBeVisible();
  await expect(members.getByText('@kevin · dabei')).toBeVisible();
  expect(calls.group.responses).toEqual([{ session: 'g-anna', accept: true }]);
  // nur der Gastgeber lädt ein
  await expect(page.getByRole('button', { name: /einladen/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Gemeinsame Session verlassen' }).click();
  await expect(page.getByText('Du hast die gemeinsame Session verlassen.')).toBeVisible();
  expect(calls.group.left).toEqual(['g-anna']);
  await expect(page.getByText('Session läuft').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('GRP-2: Einladung ablehnen', async ({ page }) => {
  const calls = await fakeSupabase(page, [], [{ ...ANNA }]);
  calls.group.sessions.push({
    id: 'g-anna',
    host_id: 'u-anna',
    host_username: 'anna',
    host_display_name: 'Anna',
    title: null,
    water_name: 'Baldeneysee',
    started_at: '2026-11-06T16:00:00Z',
    ended_at: null,
    my_status: 'invited',
    joined_count: 1,
  });
  await signInWithProfile(page, 'kevin');
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await expect(page.getByText(/Baldeneysee · seit/)).toBeVisible();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByText('Einladung abgelehnt.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zusagen' })).toHaveCount(0);
  expect(calls.group.responses).toEqual([{ session: 'g-anna', accept: false }]);
});

const HIGHLIGHT_ANNA = {
  id: 'post-anna-hl',
  author_id: 'u-anna',
  username: 'anna',
  display_name: 'Anna',
  badges: [],
  caption: 'Erster Zander des Abends',
  visibility: 'friends',
  photo_paths: ['u-anna/post-anna-hl/1.jpg'],
  created_at: '2026-11-06T17:30:00Z',
  group_session_id: 'g-anna',
  group_title: 'Abendansitz',
};

test('GRP-3: Highlights – sichtbar in der Session und im Feed, eigener Fang als Highlight geteilt', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [HIGHLIGHT_ANNA]);
  calls.group.sessions.push({
    id: 'g-anna',
    host_id: 'u-anna',
    host_username: 'anna',
    host_display_name: 'Anna',
    title: 'Abendansitz',
    water_name: null,
    started_at: '2026-11-06T16:00:00Z',
    ended_at: null,
    my_status: 'invited',
    joined_count: 1,
  });
  calls.group.members.set('g-anna', [
    { user_id: 'u-anna', username: 'anna', display_name: 'Anna', status: 'joined', is_host: true },
    { user_id: 'u-1', username: 'kevin', display_name: 'Kevin', status: 'invited', is_host: false },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Zusagen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Abendansitz' })).toBeVisible();
  const sessionId = new URL(page.url()).pathname.split('/').pop() ?? '';

  // Annas Highlight in der Session-Zusammenfassung
  const highlights = page.getByRole('region', { name: 'Highlights' });
  await expect(highlights.getByText('Erster Zander des Abends')).toBeVisible();
  await expect(page.getByText(/2 Personen dabei/)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });

  // im Feed mit Kennzeichnung
  await page.goto('/feed');
  await waitForApp(page);
  await expect(
    page.getByRole('article', { name: /Beitrag von Anna/ }).getByText('Highlight · Abendansitz'),
  ).toBeVisible();

  // eigenen Fang dieser Session als Highlight teilen
  await page.evaluate(async (sid) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('fangpunkt');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const now = new Date().toISOString();
    const tx = db.transaction('catches', 'readwrite');
    tx.objectStore('catches').put({
      id: 'grp-fang',
      createdAt: now,
      updatedAt: now,
      rev: 1,
      at: now,
      tz: 'Europe/Berlin',
      outcome: 'caught',
      sessionId: sid,
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, sessionId);
  await page.goto('/profil/neu?fang=grp-fang');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page));
  const pick = page.getByRole('checkbox', { name: /Als Highlight der gemeinsamen Session teilen/ });
  await expect(page.getByRole('radio', { name: 'Alle' })).toBeVisible();
  await pick.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await pick.check();
  // Sichtbarkeit wählt man bei Highlights nicht
  await expect(page.getByRole('radio', { name: 'Alle' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Posten' }).click();
  await expect
    .poll(() => [...calls.posts.values()].map((p) => (p as { group_session_id?: string }).group_session_id))
    .toEqual(['g-anna']);
  expect([...calls.posts.values()][0]?.visibility).toBe('friends');
  expect(errors).toEqual([]);
});

test('SAVE-1: Beitrag speichern – Lesezeichen im Feed, Liste „Gespeichert“ im Profil, wieder entfernen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const calls = await fakeSupabase(page, [], [{ ...ANNA }], [FEED_ANNA]);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithProfile(page, 'kevin');

  // leer
  await page.goto('/profil/gespeichert');
  await waitForApp(page);
  await expect(page.getByText('Noch nichts gespeichert')).toBeVisible();

  await page.goto('/feed');
  await waitForApp(page);
  const card = page.getByRole('article', { name: /Beitrag von Anna/ });
  const save = card.getByRole('button', { name: 'Speichern' });
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await save.click();
  await expect(card.getByRole('button', { name: 'Gespeichert' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => [...calls.saves]).toEqual(['post-anna-1']);

  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Profil' })
    .click();
  await page.getByRole('button', { name: 'Gespeichert' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gespeichert' })).toBeVisible();
  const savedCard = page.getByRole('article', { name: /Beitrag von Anna/ });
  await expect(savedCard.getByText('Zander am Abend')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await savedCard.getByRole('button', { name: 'Gespeichert' }).click();
  await expect(savedCard.getByRole('button', { name: 'Speichern' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => calls.saves.length).toBe(0);
  expect(errors).toEqual([]);
});
