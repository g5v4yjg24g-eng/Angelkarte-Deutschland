// Supabase (Auth + Postgres, Region EU/Irland): freiwilliges Konto. Der Client wird erst geladen, wenn das Konto
// gebraucht wird (eigener Chunk); ohne gespeicherte Anmeldung sendet die App nichts an Supabase.
// Server: supabase/migrations/*_profiles.sql (Tabelle profiles mit RLS, Funktionen username_available,
// delete_my_account). Nur der öffentliche Schlüssel steht in der App.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../domain/account';
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

export function supabaseAccount(url: string | undefined, key: string | undefined): AccountProvider {
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
          // Anmeldung nur per Code – keine Links in der Adresse auswerten
          detectSessionInUrl: false,
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
      ).auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
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
    async deleteAccount() {
      const c = await get();
      const { error } = await c.rpc('delete_my_account');
      if (error) fail(error);
      // Server-Konto ist weg: lokale Anmeldung entfernen
      await c.auth.signOut({ scope: 'local' });
    },
  };
}
