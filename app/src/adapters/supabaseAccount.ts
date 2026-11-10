// Supabase (Auth + Postgres, Region EU/Irland): freiwilliges Konto. Der Client wird erst geladen, wenn das Konto
// gebraucht wird (eigener Chunk); ohne gespeicherte Anmeldung sendet die App nichts an Supabase.
// Server: supabase/migrations/*_profiles.sql (Tabelle profiles mit RLS, Funktionen username_available,
// delete_my_account), *_user_badges.sql (nur lesbar) und *_friendships.sql (nur über Funktionen), *_posts.sql (Beiträge, Fotos im Speicher „post-photos“), *_feed.sql (Funktion feed), *_shared_spots.sql (nur über Funktionen), *_moderation.sql (Melden/Blockieren, nur über Funktionen), *_reactions.sql (Likes/Kommentare, nur über Funktionen), *_push.sql (Geräte und Einstellungen für Mitteilungen), *_moderators.sql (Moderationsbereich, jede Funktion prüft is_moderator), *_avatars.sql (Profilbild im Speicher „avatars“, nur über Funktionen), *_post_saves.sql (Lesezeichen), *_discover.sql (Entdecken, höchstens 20 neue Beiträge in 24 h), *_group_sessions.sql (gemeinsame Sessions, nur über Funktionen), *_group_highlights.sql (Highlights nur für Teilnehmer). Nur der öffentliche Schlüssel steht in der App.
import { parseGroupMembers, parseGroupSessions } from '../domain/groupSessions';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../domain/account';
import { parseBadges } from '../domain/badges';
import { FriendRequestResultSchema, parseFriendRows } from '../domain/friends';
import { photoPath, thumbPath } from '../domain/postSync';
import { FEED_PAGE, parseFeedRows, type FeedPost } from '../domain/feed';
import { parseUserHits, parseUserProfile } from '../domain/userProfile';
import { parseSharedSpotRows } from '../domain/sharedSpots';
import { parseBlockRows } from '../domain/moderation';
import { parseCommentRows, parseReactionRows } from '../domain/reactions';
import { parsePushPrefs, parsePushStatus } from '../domain/push';
import { avatarPath, parseAvatarRows } from '../domain/avatarSync';
import { newId } from '../domain/id';
import {
  parseModContent,
  parseModOverview,
  parseModLog,
  parseModReports,
  parseModUser,
  parseModUserItems,
} from '../domain/modAdmin';
import { ACCOUNT_STORAGE_KEY, AccountError, type AccountProvider, type AccountUser } from '../ports/account';

type Row = { id: string; username: string; display_name: string };
const toProfile = (r: Row): Profile => ({ id: r.id, username: r.username, displayName: r.display_name });
type AuthUser = {
  id: string;
  email?: string | undefined;
  new_email?: string | undefined;
  user_metadata?: Record<string, unknown> | undefined;
};
const toUser = (u: AuthUser | null | undefined): AccountUser | null =>
  u
    ? {
        id: u.id,
        email: u.email ?? '',
        hasPassword: u.user_metadata?.['has_password'] === true,
        ...(u.new_email ? { newEmail: u.new_email } : {}),
      }
    : null;
const fail = (
  e: { message: string; status?: number | undefined; code?: string | undefined } | null | undefined,
): never => {
  throw new AccountError(e?.message ?? 'Unbekannter Fehler', e?.status, e?.code);
};

const POST_BUCKET = 'post-photos';
/** Gültigkeit der Foto-Adressen: nach „Nur ich“ ist ein Bild höchstens so lange über eine alte Adresse abrufbar */
const PHOTO_URL_SECONDS = 600;

/** Zeitlich begrenzte Foto-Adressen (10 min, Freigabe Nutzer 2026-11-10); der Speicher prüft dabei selbst, ob man den Beitrag sehen darf */
async function withPhotoUrls(c: SupabaseClient, posts: Omit<FeedPost, 'photoUrls'>[]): Promise<FeedPost[]> {
  const paths = posts.flatMap((p) => p.photoPaths);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error } = await c.storage.from(POST_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS);
    if (error) fail(error);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return posts.map((p) => ({ ...p, photoUrls: p.photoPaths.map((path) => urls.get(path) ?? '') }));
}
const AVATAR_BUCKET = 'avatars';

/** Alle Dateien eines Ordners im Fotospeicher löschen */
async function removeFolder(c: SupabaseClient, folder: string) {
  const { data, error } = await c.storage.from(POST_BUCKET).list(folder, { limit: 100 });
  if (error) fail(error);
  const files = (data ?? []).map((f) => `${folder}/${f.name}`);
  if (files.length) {
    const { error: e } = await c.storage.from(POST_BUCKET).remove(files);
    if (e) fail(e);
  }
}

export function supabaseAccount(
  url: string | undefined,
  key: string | undefined,
  /** Ziel des Anmelde-Links aus der Standard-Mail (Übergangslösung, solange kein eigener Mailanbieter da ist) */
  redirectTo?: string,
): AccountProvider {
  const enabled = !!url && !!key;
  let client: Promise<SupabaseClient> | undefined;
  const get = () => {
    if (!enabled) throw new AccountError('Konto nicht eingerichtet');
    client ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url as string, key as string, {
        auth: {
          storageKey: ACCOUNT_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          // Code (verifyOtp) oder Link aus der Standard-Mail: Der Link liefert die Anmeldung im #-Teil der Adresse
          // (implizit statt PKCE, damit er auch in einem anderen Browser als dem anfragenden funktioniert)
          flowType: 'implicit',
          detectSessionInUrl: true,
        },
      }),
    );
    return client;
  };
  const uid = async (c: SupabaseClient) => {
    const { data } = await c.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AccountError('not signed in', 401);
    return id;
  };

  return {
    enabled,
    host: url ? new URL(url).host : undefined,
    async currentUser() {
      if (!enabled) return null;
      const c = await get();
      const { data } = await c.auth.getSession();
      return toUser(data.session?.user);
    },
    onChange(listener) {
      if (!enabled) return () => undefined;
      let unsub: () => void = () => undefined;
      let gone = false;
      void get().then((c) => {
        if (gone) return;
        const { data } = c.auth.onAuthStateChange((_e, session) => listener(toUser(session?.user)));
        unsub = () => data.subscription.unsubscribe();
      });
      return () => {
        gone = true;
        unsub();
      };
    },
    async signIn(email, password) {
      const { data, error } = await (await get()).auth.signInWithPassword({ email, password });
      if (error) fail(error);
      const user = toUser(data.user);
      if (!user) throw new AccountError('Anmeldung fehlgeschlagen');
      return user;
    },
    async signUp(email, password) {
      const { error } = await (await get()).auth.signUp({
        email,
        password,
        options: { data: { has_password: true }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
      });
      if (error) fail(error);
    },
    async confirmSignUp(email, code) {
      const { data, error } = await (await get()).auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) fail(error);
      const user = toUser(data.user);
      if (!user) throw new AccountError('Bestätigung fehlgeschlagen');
      return user;
    },
    async resendConfirmation(email) {
      const { error } = await (await get()).auth.resend({
        type: 'signup',
        email,
        ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
      });
      if (error) fail(error);
    },
    async requestPasswordReset(email) {
      const { error } = await (await get()).auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : {});
      if (error) fail(error);
    },
    async confirmPasswordReset(email, code) {
      const { data, error } = await (await get()).auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (error) fail(error);
      const user = toUser(data.user);
      if (!user) throw new AccountError('Bestätigung fehlgeschlagen');
      return user;
    },
    async setPassword(password) {
      const c = await get();
      const { error } = await c.auth.updateUser({ password, data: { has_password: true } });
      if (error) fail(error);
      // wer das Passwort kennt oder ändert, soll die einzige laufende Anmeldung haben
      await c.auth.signOut({ scope: 'others' }).catch(() => undefined);
    },
    async verifyPassword(password) {
      const c = await get();
      const { data } = await c.auth.getSession();
      const email = data.session?.user.email;
      if (!email) throw new AccountError('not signed in', 401);
      const { error } = await c.auth.signInWithPassword({ email, password });
      if (!error) return true;
      if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) return false;
      return fail(error);
    },
    async changeEmail(newEmail) {
      const { error } = await (await get()).auth.updateUser(
        { email: newEmail },
        redirectTo ? { emailRedirectTo: redirectTo } : {},
      );
      if (error) fail(error);
    },
    async signOutOthers() {
      const { error } = await (await get()).auth.signOut({ scope: 'others' });
      if (error) fail(error);
    },
    async signOut() {
      const { error } = await (await get()).auth.signOut();
      if (error) fail(error);
    },
    async getProfile() {
      const c = await get();
      const id = await uid(c);
      const { data, error } = await c
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', id)
        .maybeSingle();
      if (error) fail(error);
      return data ? toProfile(data as Row) : null;
    },
    async usernameAvailable(username) {
      const { data, error } = await (await get()).rpc('username_available', { name: username });
      if (error) fail(error);
      return data === true;
    },
    async createProfile(username, displayName) {
      const c = await get();
      const id = await uid(c);
      const { data, error } = await c
        .from('profiles')
        .insert({ id, username, display_name: displayName })
        .select('id, username, display_name')
        .single();
      if (error) fail(error);
      return toProfile(data as Row);
    },
    async updateDisplayName(displayName) {
      const c = await get();
      const id = await uid(c);
      const { data, error } = await c
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', id)
        .select('id, username, display_name')
        .single();
      if (error) fail(error);
      return toProfile(data as Row);
    },
    async myBadges() {
      const c = await get();
      const id = await uid(c);
      const { data, error } = await c.from('user_badges').select('badge').eq('user_id', id);
      if (error) fail(error);
      return parseBadges(data as { badge: unknown }[] | null);
    },
    async friends() {
      const { data, error } = await (await get()).rpc('my_friends');
      if (error) fail(error);
      return parseFriendRows(data as unknown[] | null);
    },
    async sendFriendRequest(username) {
      const { data, error } = await (await get()).rpc('send_friend_request', { name: username });
      if (error) fail(error);
      const r = FriendRequestResultSchema.safeParse(data);
      if (!r.success) throw new AccountError('Unerwartete Antwort');
      return r.data;
    },
    async respondFriendRequest(requestId, accept) {
      const { error } = await (await get()).rpc('respond_friend_request', { request: requestId, accept });
      if (error) fail(error);
    },
    async removeFriend(userId) {
      const { error } = await (await get()).rpc('remove_friend', { other: userId });
      if (error) fail(error);
    },
    async publishPost(post) {
      const c = await get();
      const id = await uid(c);
      const folder = `${id}/${post.id}`;
      // Was schon im Speicher liegt (früherer, abgebrochener Versuch), wird nicht erneut hochgeladen
      const { data: existing, error: listError } = await c.storage.from(POST_BUCKET).list(folder, { limit: 100 });
      if (listError) fail(listError);
      const have = new Set((existing ?? []).map((f) => `${folder}/${f.name}`));
      const upload = async (path: string, blob: Blob, contentType: string) => {
        if (have.has(path)) return;
        const { error } = await c.storage.from(POST_BUCKET).upload(path, blob, { contentType, upsert: true });
        if (error) fail(error);
      };
      const paths: string[] = [];
      for (const [i, photo] of post.photos.entries()) {
        const path = photoPath(id, post.id, i, photo.mime);
        await upload(path, photo.blob, photo.mime);
        if (photo.thumb) await upload(thumbPath(path), photo.thumb, 'image/jpeg');
        paths.push(path);
      }
      // Kein Upsert: der bräuchte Schreibrechte auf alle Spalten und scheiterte immer (*_publish_post.sql)
      const { error } = await c.rpc('publish_post', {
        post_id: post.id,
        caption: post.caption ?? null,
        vis: post.visibility,
        paths,
        created: post.createdAt,
        species: post.speciesId ?? null,
        length: post.lengthCm ?? null,
        grp: post.groupId ?? null,
      });
      if (error) fail(error);
      // Gegenprobe: Ist das Foto für den Eigentümer abrufbar?
      const { error: checkError } = await c.storage.from(POST_BUCKET).createSignedUrl(paths[0] ?? '', 60);
      if (checkError) fail(checkError);
    },
    async downloadPostPhotos(paths) {
      const c = await get();
      const folder = paths[0]?.split('/').slice(0, 2).join('/') ?? '';
      // erst nachsehen, was da ist (ältere Beiträge haben kein Vorschaubild) – so gibt es keine Fehlanfragen
      const { data: files, error: listError } = await c.storage.from(POST_BUCKET).list(folder, { limit: 100 });
      if (listError) return undefined;
      const have = new Set((files ?? []).map((f) => `${folder}/${f.name}`));
      const load = async (path: string) => {
        const { data, error } = await c.storage.from(POST_BUCKET).download(path);
        return error || !data ? undefined : data;
      };
      const out: { blob: Blob; thumb?: Blob | undefined }[] = [];
      for (const path of paths) {
        if (!have.has(path)) return undefined;
        const blob = await load(path);
        if (!blob) return undefined;
        const thumb = have.has(thumbPath(path)) ? await load(thumbPath(path)) : undefined;
        out.push({ blob, thumb });
      }
      return out;
    },
    async updateSharedPost(postId, changes) {
      const c = await get();
      const { error } = await c
        .from('posts')
        .update({
          caption: changes.caption ?? null,
          visibility: changes.visibility,
          species_id: changes.speciesId ?? null,
          length_cm: changes.lengthCm ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);
      if (error) fail(error);
    },
    async deleteSharedPost(postId) {
      const c = await get();
      const id = await uid(c);
      await removeFolder(c, `${id}/${postId}`);
      const { error } = await c.from('posts').delete().eq('id', postId);
      if (error) fail(error);
    },
    async feed(before) {
      const c = await get();
      const { data, error } = await c.rpc('feed', { before: before ?? null, max_rows: FEED_PAGE });
      if (error) fail(error);
      return withPhotoUrls(c, parseFeedRows(data as unknown[] | null));
    },
    async toggleSave(postId) {
      const { data, error } = await (await get()).rpc('toggle_save', { post: postId });
      if (error) fail(error);
      return data === true;
    },
    async savedIds(postIds) {
      if (postIds.length === 0) return new Set();
      const { data, error } = await (await get()).rpc('my_saved_ids', { posts: postIds.slice(0, 100) });
      if (error) fail(error);
      return new Set((Array.isArray(data) ? data : []).filter((x): x is string => typeof x === 'string'));
    },
    async savedPosts(before) {
      const c = await get();
      const { data, error } = await c.rpc('saved_posts', { before: before ?? null, max_rows: FEED_PAGE });
      if (error) fail(error);
      return withPhotoUrls(c, parseFeedRows(data as unknown[] | null));
    },
    async discoverFeed(before) {
      const c = await get();
      const { data, error } = await c.rpc('discover_feed', { before: before ?? null, max_rows: FEED_PAGE });
      if (error) fail(error);
      return withPhotoUrls(c, parseFeedRows(data as unknown[] | null));
    },
    async createGroupSession(input) {
      const { data, error } = await (
        await get()
      ).rpc('create_group_session', {
        title: input.title ?? null,
        water_name: input.waterName ?? null,
      });
      if (error) fail(error);
      if (typeof data !== 'string') throw new AccountError('Keine Session-ID');
      return data;
    },
    async inviteToGroupSession(groupId, userIds) {
      const { data, error } = await (
        await get()
      ).rpc('invite_to_group_session', {
        session: groupId,
        users: userIds.slice(0, 20),
      });
      if (error) fail(error);
      return typeof data === 'number' ? data : 0;
    },
    async respondGroupInvite(groupId, accept) {
      const { error } = await (await get()).rpc('respond_group_invite', { session: groupId, accept });
      if (error) fail(error);
    },
    async leaveGroupSession(groupId) {
      const { error } = await (await get()).rpc('leave_group_session', { session: groupId });
      if (error) fail(error);
    },
    async endGroupSession(groupId) {
      const { error } = await (await get()).rpc('end_group_session', { session: groupId });
      if (error) fail(error);
    },
    async myGroupSessions() {
      const { data, error } = await (await get()).rpc('my_group_sessions');
      if (error) fail(error);
      return parseGroupSessions(data as unknown[] | null);
    },
    async groupSessionMembers(groupId) {
      const { data, error } = await (await get()).rpc('group_session_members_list', { session: groupId });
      if (error) fail(error);
      return parseGroupMembers(data as unknown[] | null);
    },
    async groupHighlights(groupId, before) {
      const c = await get();
      const { data, error } = await c.rpc('group_highlights', {
        session: groupId,
        before: before ?? null,
        max_rows: FEED_PAGE,
      });
      if (error) fail(error);
      return withPhotoUrls(c, parseFeedRows(data as unknown[] | null));
    },
    async setProfileExtras(payload) {
      const { error } = await (
        await get()
      ).rpc('set_my_profile_extras', {
        new_bio: payload.bio,
        species: payload.targetSpecies,
        new_methods: payload.methods,
        new_region: payload.region,
        highlights: payload.highlightPostIds,
      });
      if (error) fail(error);
    },
    async userProfile(username) {
      const { data, error } = await (await get()).rpc('user_profile', { name: username });
      if (error) fail(error);
      return parseUserProfile(data as unknown[] | null);
    },
    async userPosts(userId, before, onlyIds) {
      const c = await get();
      const { data, error } = await c.rpc('user_posts', {
        author: userId,
        before: before ?? null,
        max_rows: FEED_PAGE,
        only_ids: onlyIds ?? null,
      });
      if (error) fail(error);
      return withPhotoUrls(c, parseFeedRows(data as unknown[] | null));
    },
    async searchUsers(term) {
      const { data, error } = await (await get()).rpc('search_users', { q: term });
      if (error) fail(error);
      return parseUserHits(data as unknown[] | null);
    },
    async sharedSpots() {
      const { data, error } = await (await get()).rpc('my_shared_spots');
      if (error) fail(error);
      return parseSharedSpotRows(data as unknown[] | null);
    },
    async shareSpot(input) {
      const { error } = await (
        await get()
      ).rpc('share_spot', {
        place: input.placeId,
        recipient: input.recipientId ?? null,
        kind: input.type,
        spot_name: input.name ?? null,
        spot_note: input.note ?? null,
        spot_lat: input.lat,
        spot_lng: input.lng,
      });
      if (error) fail(error);
    },
    async unshareSpot(id) {
      const { error } = await (await get()).rpc('unshare_spot', { spot: id });
      if (error) fail(error);
    },
    async report(input) {
      const { error } = await (
        await get()
      ).rpc('report_content', {
        kind: input.kind,
        target: input.targetId,
        target_owner: input.targetUserId,
        why: input.reason,
        note: input.details ?? null,
      });
      if (error) fail(error);
    },
    async blockUser(userId) {
      const { error } = await (await get()).rpc('block_user', { other: userId });
      if (error) fail(error);
    },
    async unblockUser(userId) {
      const { error } = await (await get()).rpc('unblock_user', { other: userId });
      if (error) fail(error);
    },
    async blockedUsers() {
      const { data, error } = await (await get()).rpc('my_blocks');
      if (error) fail(error);
      return parseBlockRows(data as unknown[] | null);
    },
    async postReactions(postIds) {
      if (postIds.length === 0) return new Map();
      const { data, error } = await (await get()).rpc('post_reactions', { posts: postIds.slice(0, 100) });
      if (error) fail(error);
      return parseReactionRows(data as unknown[] | null);
    },
    async toggleLike(postId) {
      const { data, error } = await (await get()).rpc('toggle_like', { post: postId });
      if (error) fail(error);
      return data === true;
    },
    async postComments(postId) {
      const { data, error } = await (await get()).rpc('post_comment_list', { post: postId });
      if (error) fail(error);
      return parseCommentRows(data as unknown[] | null);
    },
    async addComment(postId, text) {
      const { error } = await (await get()).rpc('add_comment', { post: postId, body: text });
      if (error) fail(error);
    },
    async deleteComment(commentId) {
      const { error } = await (await get()).rpc('delete_comment', { comment: commentId });
      if (error) fail(error);
    },
    async registerPushDevice(token) {
      const { error } = await (await get()).rpc('register_push_device', { device: token });
      if (error) fail(error);
    },
    async unregisterPushDevice(token) {
      const { error } = await (await get()).rpc('unregister_push_device', { device: token });
      if (error) fail(error);
    },
    async pushPrefs() {
      const { data, error } = await (await get()).rpc('my_push_prefs');
      if (error) fail(error);
      return parsePushPrefs(data as unknown[] | null);
    },
    async setPushPrefs(prefs) {
      const { error } = await (await get()).rpc('set_push_prefs', prefs);
      if (error) fail(error);
    },
    async sendTestPush() {
      const { data, error } = await (await get()).rpc('send_test_push');
      if (error) fail(error);
      return typeof data === 'number' ? data : 0;
    },
    async pushStatus() {
      const { data, error } = await (await get()).rpc('my_push_status');
      if (error) fail(error);
      return parsePushStatus(data as unknown[] | null);
    },
    async isModerator() {
      const { data, error } = await (await get()).rpc('is_moderator');
      if (error) fail(error);
      return data === true;
    },
    async modReports(state) {
      const { data, error } = await (await get()).rpc('mod_reports', { state });
      if (error) fail(error);
      return parseModReports(data as unknown[] | null);
    },
    async modOverview() {
      const c = await get();
      const { data, error } = await c.rpc('mod_overview');
      const parsed = error ? undefined : parseModOverview(data as unknown[] | null);
      if (parsed) return parsed;
      // Funktion (noch) nicht eingespielt: nur zählen, was sicher bekannt ist
      if (error && !/mod_overview|PGRST202|does not exist/i.test(`${error.code ?? ''} ${error.message}`)) fail(error);
      const { data: open, error: e } = await c.rpc('mod_reports', { state: 'open' });
      if (e) fail(e);
      return { openReports: parseModReports(open as unknown[] | null).length };
    },
    async modContent(kind, id) {
      const { data, error } = await (await get()).rpc('mod_content', { kind, target: id });
      if (error) fail(error);
      return parseModContent(data as unknown[] | null);
    },
    async modUser(userId) {
      const { data, error } = await (await get()).rpc('mod_user', { who: userId });
      if (error) fail(error);
      return parseModUser(data as unknown[] | null);
    },
    async modUserContent(userId) {
      const { data, error } = await (await get()).rpc('mod_user_content', { who: userId });
      if (error) fail(error);
      return parseModUserItems(data as unknown[] | null);
    },
    async modUserLog(userId) {
      const { data, error } = await (await get()).rpc('mod_user_log', { who: userId });
      if (error) fail(error);
      return parseModLog(data as unknown[] | null);
    },
    async modPhotoUrls(paths) {
      if (paths.length === 0) return [];
      const { data, error } = await (await get()).storage.from(POST_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS);
      if (error) fail(error);
      const urls = new Map((data ?? []).map((s) => [s.path, s.signedUrl]));
      return paths.map((p) => urls.get(p) ?? '');
    },
    async modDeleteContent(kind, id, photoPaths, reportId, note) {
      const c = await get();
      if (kind === 'post' && photoPaths.length) {
        const { error } = await c.storage.from(POST_BUCKET).remove(photoPaths);
        if (error) fail(error);
      }
      const { error } = await c.rpc('mod_delete_content', {
        kind,
        target: id,
        report: reportId ?? null,
        note: note ?? null,
      });
      if (error) fail(error);
    },
    async modWarn(userId, note, reportId) {
      const { error } = await (await get()).rpc('mod_warn', { who: userId, report: reportId ?? null, note });
      if (error) fail(error);
    },
    async modPasswordNotice(send) {
      const { data, error } = await (await get()).functions.invoke('password-notice', { body: { send } });
      if (error) fail(error);
      const r = (data ?? {}) as { pending?: unknown; sent?: unknown; failed?: unknown };
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      return { pending: num(r.pending), sent: num(r.sent), failed: num(r.failed) };
    },
    async modResolve(reportId, note) {
      const { error } = await (await get()).rpc('mod_resolve', { report: reportId, note: note ?? null });
      if (error) fail(error);
    },
    async modBan(userId, days, reason, reportId) {
      const { error } = await (
        await get()
      ).rpc('mod_ban', {
        who: userId,
        days,
        reason,
        report: reportId ?? null,
      });
      if (error) fail(error);
    },
    async modUnban(userId, note) {
      const { error } = await (await get()).rpc('mod_unban', { who: userId, note: note ?? null });
      if (error) fail(error);
    },
    async publishAvatar(photo) {
      const c = await get();
      const me = await uid(c);
      let path: string | null = null;
      if (photo) {
        path = avatarPath(me, newId());
        const { error } = await c.storage
          .from(AVATAR_BUCKET)
          .upload(path, photo, { contentType: 'image/jpeg', upsert: false });
        if (error) fail(error);
      }
      const { data: old, error } = await c.rpc('set_my_avatar', { path });
      if (error) {
        // Eintragen gescheitert: neue Datei wieder entfernen, das bisherige Bild bleibt
        if (path) await c.storage.from(AVATAR_BUCKET).remove([path]);
        fail(error);
      }
      // Altes Bild aufräumen; scheitert das, bleibt nur eine unsichtbare Datei übrig
      if (typeof old === 'string' && old !== path) await c.storage.from(AVATAR_BUCKET).remove([old]);
    },
    async avatarUrls(userIds) {
      const out = new Map<string, string>();
      if (userIds.length === 0) return out;
      const c = await get();
      const { data, error } = await c.rpc('avatar_paths', { users: userIds.slice(0, 200) });
      if (error) fail(error);
      const paths = parseAvatarRows(data as unknown[] | null);
      if (paths.size === 0) return out;
      const { data: signed, error: e } = await c.storage
        .from(AVATAR_BUCKET)
        .createSignedUrls([...paths.values()], 3600);
      if (e) fail(e);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      for (const [id, path] of paths) {
        const u = byPath.get(path);
        if (u) out.set(id, u);
      }
      return out;
    },
    async modProfileText(userId) {
      const { data, error } = await (await get()).rpc('mod_profile_text', { who: userId });
      if (error) fail(error);
      const row = (Array.isArray(data) ? data[0] : undefined) as
        | {
            bio?: string | null;
            target_species?: string[] | null;
            methods?: string[] | null;
            region?: string | null;
          }
        | undefined;
      if (!row) return undefined;
      const facts = [
        ...(row.target_species ?? []),
        ...(row.methods ?? []),
        ...(row.region ? [row.region] : []),
      ];
      return { bio: row.bio ?? undefined, facts };
    },
    async modClearProfile(userId, note) {
      const { error } = await (
        await get()
      ).rpc('mod_clear_profile', { who: userId, report: null, note: note ?? null });
      if (error) fail(error);
    },
    async modClearAvatar(userId, reportId, note) {
      const c = await get();
      const { data: old, error } = await c.rpc('mod_clear_avatar', {
        who: userId,
        report: reportId ?? null,
        note: note ?? null,
      });
      if (error) fail(error);
      if (typeof old === 'string') {
        const { error: e } = await c.storage.from(AVATAR_BUCKET).remove([old]);
        if (e) fail(e);
      }
    },
    async deleteAccount() {
      const c = await get();
      // Fotos liegen im Speicher, nicht in der Datenbank: vor dem Konto löschen
      const me = await uid(c);
      const { data: folders } = await c.storage.from(POST_BUCKET).list(me, { limit: 1000 });
      for (const f of folders ?? []) await removeFolder(c, `${me}/${f.name}`);
      const { data: avatars } = await c.storage.from(AVATAR_BUCKET).list(me, { limit: 100 });
      const avatarFiles = (avatars ?? []).map((f) => `${me}/${f.name}`);
      if (avatarFiles.length) await c.storage.from(AVATAR_BUCKET).remove(avatarFiles);
      const { error } = await c.rpc('delete_my_account');
      if (error) fail(error);
      // Server-Konto ist weg: lokale Anmeldung entfernen
      await c.auth.signOut({ scope: 'local' });
    },
  };
}
