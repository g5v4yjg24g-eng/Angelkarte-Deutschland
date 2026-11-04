// Supabase (Auth + Postgres, Region EU/Irland): freiwilliges Konto. Der Client wird erst geladen, wenn das Konto
// gebraucht wird (eigener Chunk); ohne gespeicherte Anmeldung sendet die App nichts an Supabase.
// Server: supabase/migrations/*_profiles.sql (Tabelle profiles mit RLS, Funktionen username_available,
// delete_my_account), *_user_badges.sql (nur lesbar) und *_friendships.sql (nur über Funktionen), *_posts.sql (Beiträge, Fotos im Speicher „post-photos“), *_feed.sql (Funktion feed), *_shared_spots.sql (nur über Funktionen), *_moderation.sql (Melden/Blockieren, nur über Funktionen), *_reactions.sql (Likes/Kommentare, nur über Funktionen). Nur der öffentliche Schlüssel steht in der App.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../domain/account';
import { parseBadges } from '../domain/badges';
import { FriendRequestResultSchema, parseFriendRows } from '../domain/friends';
import { photoExt } from '../domain/postSync';
import { FEED_PAGE, parseFeedRows } from '../domain/feed';
import { parseSharedSpotRows } from '../domain/sharedSpots';
import { parseBlockRows } from '../domain/moderation';
import { parseCommentRows, parseReactionRows } from '../domain/reactions';
import { ACCOUNT_STORAGE_KEY, AccountError, type AccountProvider, type AccountUser } from '../ports/account';

type Row = { id: string; username: string; display_name: string };
const toProfile = (r: Row): Profile => ({ id: r.id, username: r.username, displayName: r.display_name });
const toUser = (u: { id: string; email?: string | undefined } | null | undefined): AccountUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;
const fail = (
  e: { message: string; status?: number | undefined; code?: string | undefined } | null | undefined,
): never => {
  throw new AccountError(e?.message ?? 'Unbekannter Fehler', e?.status, e?.code);
};

const POST_BUCKET = 'post-photos';

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
    async requestCode(email) {
      const { error } = await (
        await get()
      ).auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
      });
      if (error) fail(error);
    },
    async verifyCode(email, code) {
      const { data, error } = await (await get()).auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) fail(error);
      const user = toUser(data.user);
      if (!user) throw new AccountError('Anmeldung fehlgeschlagen');
      return user;
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
      const paths: string[] = [];
      for (const [i, photo] of post.photos.entries()) {
        const path = `${id}/${post.id}/${i + 1}.${photoExt(photo.mime)}`;
        const { error } = await c.storage
          .from(POST_BUCKET)
          .upload(path, photo.blob, { contentType: photo.mime, upsert: true });
        if (error) fail(error);
        paths.push(path);
      }
      const { error } = await c.from('posts').upsert({
        id: post.id,
        author_id: id,
        caption: post.caption ?? null,
        visibility: post.visibility,
        photo_paths: paths,
        created_at: post.createdAt,
        updated_at: new Date().toISOString(),
      });
      if (error) fail(error);
    },
    async updateSharedPost(postId, changes) {
      const c = await get();
      const { error } = await c
        .from('posts')
        .update({
          caption: changes.caption ?? null,
          visibility: changes.visibility,
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
      const posts = parseFeedRows(data as unknown[] | null);
      const paths = posts.flatMap((p) => p.photoPaths);
      const urls = new Map<string, string>();
      if (paths.length) {
        // zeitlich begrenzte Adressen (1 h); der Speicher prüft dabei selbst, ob man den Beitrag sehen darf
        const { data: signed, error: e } = await c.storage.from(POST_BUCKET).createSignedUrls(paths, 3600);
        if (e) fail(e);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      }
      return posts.map((p) => ({ ...p, photoUrls: p.photoPaths.map((path) => urls.get(path) ?? '') }));
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
    async deleteAccount() {
      const c = await get();
      // Fotos liegen im Speicher, nicht in der Datenbank: vor dem Konto löschen
      const me = await uid(c);
      const { data: folders } = await c.storage.from(POST_BUCKET).list(me, { limit: 1000 });
      for (const f of folders ?? []) await removeFolder(c, `${me}/${f.name}`);
      const { error } = await c.rpc('delete_my_account');
      if (error) fail(error);
      // Server-Konto ist weg: lokale Anmeldung entfernen
      await c.auth.signOut({ scope: 'local' });
    },
  };
}
