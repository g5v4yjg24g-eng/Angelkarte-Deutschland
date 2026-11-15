// Supabase (Auth + Postgres, Region EU/Irland): freiwilliges Konto. Der Client wird erst geladen, wenn das Konto
// gebraucht wird (eigener Chunk); ohne gespeicherte Anmeldung sendet die App nichts an Supabase.
// Server: supabase/migrations/*_profiles.sql (Tabelle profiles mit RLS, Funktionen username_available,
// delete_my_account), *_user_badges.sql (nur lesbar) und *_friendships.sql (nur über Funktionen), *_posts.sql (Beiträge, Fotos im Speicher „post-photos“), *_feed.sql (Funktion feed), *_shared_spots.sql (nur über Funktionen), *_moderation.sql (Melden/Blockieren, nur über Funktionen), *_reactions.sql (Likes/Kommentare, nur über Funktionen), *_push.sql (Geräte und Einstellungen für Mitteilungen), *_moderators.sql (Moderationsbereich, jede Funktion prüft is_moderator), *_avatars.sql (Profilbild im Speicher „avatars“, nur über Funktionen), *_post_saves.sql (Lesezeichen), *_discover.sql (Entdecken, höchstens 20 neue Beiträge in 24 h), *_group_sessions.sql (gemeinsame Sessions, nur über Funktionen), *_group_highlights.sql (Highlights nur für Teilnehmer). Nur der öffentliche Schlüssel steht in der App.
import { parseGroupMembers, parseGroupSessions } from '../domain/groupSessions';
import { parseGroupStats, statsPayload } from '../domain/groupStats';
import { parseStartRequests } from '../domain/tripStart';
import { NOTIFICATIONS_PAGE, parseNotifications, parseUnreadCount } from '../domain/notifications';
import { parseTripInvites, parseTripReplies } from '../domain/tripInvites';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../domain/account';
import { parseBadges } from '../domain/badges';
import { parseFriendRows } from '../domain/friends';
import { FollowResultSchema, parseFollowCounts, parseFollowRows } from '../domain/follows';
import { photoPath, thumbPath } from '../domain/postSync';
import { FEED_PAGE, parseFeedRows, type FeedPost } from '../domain/feed';
import { parsePrefs, parseSuggestionRows } from '../domain/suggestions';
import { parseUserHits, parseUserProfile } from '../domain/userProfile';
import { isAchVisibility, parseRemoteAchievements } from '../domain/sharedAchievements';
import { parseSharedSpotRows } from '../domain/sharedSpots';
import { parseSpotLinkRows } from '../domain/spotLinks';
import { parseBlockRows } from '../domain/moderation';
import { parseCommentRows, parseReactionRows } from '../domain/reactions';
import { parsePushPrefs, parsePushStatus } from '../domain/push';
import { avatarPath, parseAvatarRows } from '../domain/avatarSync';
import { newId } from '../domain/id';
import {
  parseModContent,
  parseModOverview,
  parseModPostState,
  parseModReporter,
  parseModUserRows,
  parseModWarnings,
  parseModLog,
  parseModReports,
  parseModUser,
  parseModUserItems,
} from '../domain/modAdmin';
import { ACCOUNT_STORAGE_KEY, AccountError, type AccountProvider, type AccountUser } from '../ports/account';
import { parseCurrentRules, parseRulesHistory } from '../domain/communityRules';
import { parseAppealInfo, parseModAppeals } from '../domain/appeals';
import {
  parseBlockedNames,
  parseModLogItems,
  parseModRole,
  parseModRoles,
  parseModStats,
} from '../domain/modTools';

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
    const { data: signed, error } = await c.storage
      .from(POST_BUCKET)
      .createSignedUrls(paths, PHOTO_URL_SECONDS);
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
      const { error } = await (
        await get()
      ).auth.signUp({
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
      const { error } = await (
        await get()
      ).auth.resend({
        type: 'signup',
        email,
        ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
      });
      if (error) fail(error);
    },
    async requestPasswordReset(email) {
      const { error } = await (
        await get()
      ).auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : {});
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
      if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message))
        return false;
      return fail(error);
    },
    async changeEmail(newEmail) {
      const { error } = await (
        await get()
      ).auth.updateUser({ email: newEmail }, redirectTo ? { emailRedirectTo: redirectTo } : {});
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
    async follows() {
      const { data, error } = await (await get()).rpc('my_follows');
      if (error) fail(error);
      return parseFollowRows(data as unknown[] | null);
    },
    async follow(username) {
      const { data, error } = await (await get()).rpc('follow_user', { name: username });
      if (error) fail(error);
      const r = FollowResultSchema.safeParse(data);
      if (!r.success) throw new AccountError('Unerwartete Antwort');
      return r.data;
    },
    async unfollow(userId) {
      const { error } = await (await get()).rpc('unfollow_user', { other: userId });
      if (error) fail(error);
    },
    async removeFollower(userId) {
      const { error } = await (await get()).rpc('remove_follower', { other: userId });
      if (error) fail(error);
    },
    async respondFollowRequest(userId, accept) {
      const { error } = await (await get()).rpc('respond_follow_request', { other: userId, accept });
      if (error) fail(error);
    },
    async followCounts() {
      const { data, error } = await (await get()).rpc('my_follow_counts');
      if (error) fail(error);
      return parseFollowCounts(data as unknown[] | null);
    },
    async accountPrivate() {
      const { data, error } = await (await get()).rpc('my_account_private');
      if (error) fail(error);
      return data !== false;
    },
    async setAccountPrivate(value) {
      const { error } = await (await get()).rpc('set_account_private', { v: value });
      if (error) fail(error);
    },
    async publishPost(post) {
      const c = await get();
      const id = await uid(c);
      const folder = `${id}/${post.id}`;
      // Was schon im Speicher liegt (früherer, abgebrochener Versuch), wird nicht erneut hochgeladen
      const { data: existing, error: listError } = await c.storage
        .from(POST_BUCKET)
        .list(folder, { limit: 100 });
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
      const { data: files, error: listError } = await c.storage
        .from(POST_BUCKET)
        .list(folder, { limit: 100 });
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
    async inviteToTrip({ trip, userIds, title, waterName, date, from, to, tz }) {
      const { data, error } = await (
        await get()
      ).rpc('invite_to_trip2', {
        trip,
        users: userIds,
        title: title ?? null,
        water_name: waterName ?? null,
        trip_date: date,
        from_time: from ?? null,
        to_time: to ?? null,
        tz,
      });
      if (error) fail(error);
      return Number(data ?? 0);
    },
    async myTripInvites() {
      const { data, error } = await (await get()).rpc('my_trip_invites');
      if (error) fail(error);
      return parseTripInvites(data as unknown[] | null);
    },
    async respondTripInvite(trip, accept) {
      const { error } = await (await get()).rpc('respond_trip_invite', { trip, accept });
      if (error) fail(error);
    },
    async tripInviteStatuses(trips) {
      const { data, error } = await (await get()).rpc('trip_invite_statuses', { trips });
      if (error) fail(error);
      return parseTripReplies(data as unknown[] | null);
    },
    async cancelTripInvites(trip) {
      const { error } = await (await get()).rpc('cancel_trip_invites', { trip });
      if (error) fail(error);
    },
    async startTripSession({ title, waterName, userIds }) {
      const { data, error } = await (
        await get()
      ).rpc('start_trip_session', {
        title: title ?? null,
        water_name: waterName ?? null,
        users: userIds,
      });
      if (error) fail(error);
      return String(data);
    },
    async startRequests() {
      const { data, error } = await (await get()).rpc('my_start_requests');
      if (error) fail(error);
      return parseStartRequests(data as unknown[] | null);
    },
    async notifications(before) {
      const { data, error } = await (
        await get()
      ).rpc('my_notifications2', {
        before: before ?? null,
        max_rows: NOTIFICATIONS_PAGE,
      });
      if (error) fail(error);
      return parseNotifications(data as unknown[] | null);
    },
    async unreadNotificationCount() {
      const { data, error } = await (await get()).rpc('unread_notification_count');
      if (error) fail(error);
      return parseUnreadCount(data);
    },
    async markNotificationsRead() {
      const { error } = await (await get()).rpc('mark_notifications_read');
      if (error) fail(error);
    },
    async deleteNotification(id) {
      const { error } = await (await get()).rpc('delete_notification', { notification: id });
      if (error) fail(error);
    },
    async clearNotifications() {
      const { data, error } = await (await get()).rpc('clear_notifications');
      if (error) fail(error);
      return parseUnreadCount(data);
    },
    async setGroupStats(groupId, stats) {
      const { error } = await (
        await get()
      ).rpc('set_my_group_stats', {
        session: groupId,
        stats: statsPayload(stats),
      });
      if (error) fail(error);
    },
    async groupStats(groupId) {
      const { data, error } = await (await get()).rpc('group_session_stats_list', { session: groupId });
      if (error) fail(error);
      return parseGroupStats(data as unknown[] | null);
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
      const { data, error } = await (await get()).rpc('user_profile_v2', { name: username });
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
    async setMyAchievements(entries) {
      const { error } = await (await get()).rpc('set_my_achievements', { entries });
      if (error) fail(error);
    },
    async myAchievementsVisibility() {
      const { data, error } = await (await get()).rpc('my_achievements_visibility');
      if (error) fail(error);
      return isAchVisibility(data) ? data : 'friends';
    },
    async setMyAchievementsVisibility(v) {
      const { error } = await (await get()).rpc('set_my_achievements_visibility', { v });
      if (error) fail(error);
    },
    async userAchievements(userId) {
      const { data, error } = await (await get()).rpc('user_achievements', { author: userId });
      if (error) fail(error);
      return parseRemoteAchievements(data as unknown[] | null);
    },
    async searchUsers(term) {
      const { data, error } = await (await get()).rpc('search_users_v2', { q: term });
      if (error) fail(error);
      return parseUserHits(data as unknown[] | null);
    },
    async suggestAnglers(max = 20) {
      const { data, error } = await (await get()).rpc('suggest_anglers', { max_rows: max });
      if (error) fail(error);
      return parseSuggestionRows(data as unknown[] | null);
    },
    async dismissSuggestion(userId) {
      const { error } = await (await get()).rpc('dismiss_suggestion', { other: userId });
      if (error) fail(error);
    },
    async suggestionPrefs() {
      const { data, error } = await (await get()).rpc('my_suggestion_prefs');
      if (error) fail(error);
      return parsePrefs(data as unknown[] | null);
    },
    async setSuggestionPrefs(prefs) {
      const { error } = await (
        await get()
      ).rpc('set_my_suggestion_prefs', { discoverable: prefs.discoverable, waters_on: prefs.watersOn });
      if (error) fail(error);
    },
    async setMyRegion(cell) {
      const { error } = await (await get()).rpc('set_my_region', { lat: cell.lat, lng: cell.lng });
      if (error) fail(error);
    },
    async clearMyRegion() {
      const { error } = await (await get()).rpc('clear_my_region');
      if (error) fail(error);
    },
    async setMyWaters(list) {
      const { data, error } = await (await get()).rpc('set_my_waters', { entries: list });
      if (error) fail(error);
      return typeof data === 'number' ? data : 0;
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
    async spotLinks() {
      const { data, error } = await (await get()).rpc('my_spot_links');
      if (error) fail(error);
      return parseSpotLinkRows(data as unknown[] | null);
    },
    async offerSpotLink(partnerId) {
      const { data, error } = await (await get()).rpc('offer_spot_link', { partner: partnerId });
      if (error) fail(error);
      return data === 'pending' || data === 'already' || data === 'accepted' ? data : 'offered';
    },
    async respondSpotLink(link, accept) {
      const { error } = await (await get()).rpc('respond_spot_link', { link, accept });
      if (error) fail(error);
    },
    async joinSpotLink(link) {
      const { error } = await (await get()).rpc('join_spot_link', { link });
      if (error) fail(error);
    },
    async endSpotLink(link) {
      const { error } = await (await get()).rpc('end_spot_link', { link });
      if (error) fail(error);
    },
    async unsharePlace(placeId) {
      const { error } = await (await get()).rpc('unshare_place', { place: placeId });
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
      const c = await get();
      const { data, error } = await c.rpc('mod_reports2', { state });
      if (!error) return parseModReports(data as unknown[] | null);
      // neue Funktion noch nicht eingespielt: bisherige Liste (kennt „in Bearbeitung“ noch nicht)
      if (!/mod_reports2|PGRST202|does not exist/i.test(`${error.code ?? ''} ${error.message}`)) fail(error);
      if (state === 'in_progress') return [];
      const old = await c.rpc('mod_reports', { state });
      if (old.error) fail(old.error);
      return parseModReports(old.data as unknown[] | null);
    },
    async modSetReportStatus(reportId, status, note) {
      const { error } = await (
        await get()
      ).rpc('mod_set_report_status', {
        report: reportId,
        new_status: status,
        note: note ?? null,
      });
      if (error) fail(error);
    },
    async modReportReporter(reportId) {
      const { data, error } = await (await get()).rpc('mod_report_reporter', { report: reportId });
      if (error) fail(error);
      return parseModReporter(data as unknown[] | null);
    },
    async modReportLog(reportId) {
      const { data, error } = await (await get()).rpc('mod_report_log', { report: reportId });
      if (error) fail(error);
      return parseModLog(data as unknown[] | null);
    },
    async modHidePost(postId, reportId, reason) {
      const { error } = await (
        await get()
      ).rpc('mod_hide_post', {
        post: postId,
        report: reportId ?? null,
        reason,
      });
      if (error) fail(error);
    },
    async modRestorePost(postId, reportId, note) {
      const { error } = await (
        await get()
      ).rpc('mod_restore_post', {
        post: postId,
        report: reportId ?? null,
        note: note ?? null,
      });
      if (error) fail(error);
    },
    async modPostState(postId) {
      const { data, error } = await (await get()).rpc('mod_post_state', { post: postId });
      if (error) fail(error);
      return parseModPostState(data as unknown[] | null);
    },
    async modOverview() {
      const c = await get();
      const { data, error } = await c.rpc('mod_overview');
      const parsed = error ? undefined : parseModOverview(data as unknown[] | null);
      if (parsed) return parsed;
      // Funktion (noch) nicht eingespielt: nur zählen, was sicher bekannt ist
      if (error && !/mod_overview|PGRST202|does not exist/i.test(`${error.code ?? ''} ${error.message}`))
        fail(error);
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
      const { data, error } = await (
        await get()
      ).storage
        .from(POST_BUCKET)
        .createSignedUrls(paths, PHOTO_URL_SECONDS);
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
    async modAddWarning(userId, reason, reportId, postId) {
      const { error } = await (
        await get()
      ).rpc('mod_add_warning', {
        who: userId,
        reason,
        report: reportId ?? null,
        post: postId ?? null,
      });
      if (error) fail(error);
    },
    async modRevokeWarning(warningId, note) {
      const { error } = await (
        await get()
      ).rpc('mod_revoke_warning', { warning: warningId, note: note ?? null });
      if (error) fail(error);
    },
    async modUserWarnings(userId) {
      const { data, error } = await (await get()).rpc('mod_user_warnings', { who: userId });
      if (error) fail(error);
      return parseModWarnings(data as unknown[] | null);
    },
    async modUsers(query, filter, before) {
      const { data, error } = await (
        await get()
      ).rpc('mod_users', { q: query, filter, before: before ?? null });
      if (error) fail(error);
      return parseModUserRows(data as unknown[] | null);
    },
    async modMyRole() {
      const { data, error } = await (await get()).rpc('mod_my_role');
      // fehlt die Funktion noch: keine Rolle anzeigen
      if (error) return undefined;
      return parseModRole(data);
    },
    async modRoles() {
      const { data, error } = await (await get()).rpc('mod_roles');
      if (error) fail(error);
      return parseModRoles(data as unknown[] | null);
    },
    async modBlockedNames() {
      const { data, error } = await (await get()).rpc('mod_blocked_usernames');
      if (error) fail(error);
      return parseBlockedNames(data as unknown[] | null);
    },
    async modAddBlockedName(pattern, kind, note) {
      const { error } = await (
        await get()
      ).rpc('mod_add_blocked_username', { pattern, kind, note: note ?? null });
      if (error) fail(error);
    },
    async modRemoveBlockedName(pattern) {
      const { error } = await (await get()).rpc('mod_remove_blocked_username', { pattern });
      if (error) fail(error);
    },
    async modLogList(action, before) {
      const { data, error } = await (
        await get()
      ).rpc('mod_log_list', {
        what: action ?? null,
        before: before ?? null,
      });
      if (error) fail(error);
      return parseModLogItems(data as unknown[] | null);
    },
    async currentRules() {
      const { data, error } = await (await get()).rpc('current_rules');
      if (error) fail(error);
      return parseCurrentRules(data as unknown[] | null);
    },
    async myRulesConsent() {
      const { data, error } = await (await get()).rpc('my_rules_consent');
      if (error) fail(error);
      return typeof data === 'number' ? data : 0;
    },
    async acceptRules(version) {
      const { error } = await (await get()).rpc('accept_rules', { v: version });
      if (error) fail(error);
    },
    async modRulesHistory() {
      const { data, error } = await (await get()).rpc('mod_rules_history');
      if (error) fail(error);
      return parseRulesHistory(data as unknown[] | null);
    },
    async modPublishRules(intro, items, summary) {
      const { data, error } = await (await get()).rpc('mod_publish_rules', { intro, items, summary });
      if (error) fail(error);
      return typeof data === 'number' ? data : 0;
    },
    async appealInfo(token) {
      const { data, error } = await (await get()).rpc('appeal_info', { token });
      if (error) fail(error);
      return parseAppealInfo(data as unknown[] | null);
    },
    async submitAppeal(token, body) {
      const { error } = await (await get()).rpc('submit_appeal', { token, body });
      if (error) fail(error);
    },
    async modAppeals(state) {
      const { data, error } = await (await get()).rpc('mod_appeals', { state });
      if (error) fail(error);
      return parseModAppeals(data as unknown[] | null);
    },
    async modDecideAppeal(id, accept, note) {
      const { error } = await (
        await get()
      ).rpc('mod_decide_appeal', { appeal: id, accept, note: note ?? null });
      if (error) fail(error);
    },
    async modStats(days) {
      const { data, error } = await (await get()).rpc('mod_stats', { days });
      if (error) fail(error);
      return parseModStats(data);
    },
    async modCanSearchEmail() {
      const { data, error } = await (await get()).rpc('mod_can_search_email');
      // fehlt die Funktion noch: keine E-Mail-Suche anbieten
      if (error) return false;
      return data === true;
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
