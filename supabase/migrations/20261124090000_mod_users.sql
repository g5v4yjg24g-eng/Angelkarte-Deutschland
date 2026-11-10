-- Fangpunkt – Admin-Bereich, Nutzerverwaltung (Wunsch Nutzer 2026-11-10, Vorschau freigegeben).
-- Nur erweiternd: kein Konto, keine Meldung und kein Protokolleintrag wird gelöscht.
--  1. Verwarnungen als eigene Einträge (Grund, Datum, betroffene Person, verantwortlicher Moderator, optional Bezug zu
--     Meldung oder Beitrag), Mail an die Person, zurücknehmbar. Keine automatische Sperre nach X Verwarnungen.
--  2. Kontenliste und Suche (Nutzername/Anzeigename, Nutzer-ID; E-Mail nur exakt und nur für das Founder-Konto –
--     jede E-Mail-Suche wird protokolliert, die Adresse selbst nie gespeichert oder ausgegeben).
--  3. Dauerhafte Sperre nur mit frischer Passwort-Anmeldung (höchstens 5 Minuten alt) – Schutz, falls ein
--     Moderatorenkonto in falsche Hände gerät. Geprüft am Anmelde-Token (amr), nicht in der App.
--  4. Gesperrte Konten können nichts mehr schreiben – auch nicht mit einem noch gültigen Zugangs-Token (bis 1 h).

-- Protokoll: weitere Aktionen
alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban',
                    'unban', 'resolve', 'in_progress', 'reopen', 'hide_post', 'restore_post', 'view_reporter',
                    'revoke_warning', 'search_email'));

-- 1. Verwarnungen -----------------------------------------------------------------------------------------
create table public.warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  report_id uuid references public.reports (id) on delete set null,
  -- Bezug zu einem Beitrag (ohne Fremdschlüssel: der Beitrag kann später gelöscht sein)
  post_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- „aktiv“ = nicht zurückgenommen und noch nicht abgelaufen (90 Tage); danach bleibt sie im Verlauf sichtbar
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoke_note text check (revoke_note is null or char_length(revoke_note) <= 500),
  notified_at timestamptz
);
create index warnings_user on public.warnings (user_id, created_at desc);
alter table public.warnings enable row level security;
revoke all on public.warnings from anon, authenticated;
-- Mail an die verwarnte Person (Edge Function notify-report, Adresse hyper-function)
grant select, update (notified_at) on public.warnings to service_role;

-- Bisherige Verwarnungen (nur Protokolleintrag) übernehmen – ohne erneute Mail
insert into public.warnings (user_id, reason, report_id, created_by, created_at, expires_at, notified_at)
select l.target_user, coalesce(nullif(btrim(l.detail), ''), '(ohne Begründung)'), l.report_id, l.moderator,
       l.created_at, l.created_at + interval '90 days', l.created_at
from public.moderation_log l
where l.action = 'warn' and l.target_user is not null;

create function public.active_warnings(who uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.warnings w
  where w.user_id = who and w.revoked_at is null and w.expires_at > now();
$$;
revoke execute on function public.active_warnings(uuid) from public, anon, authenticated;

-- Schutz vor Massenaktionen: Verwarnungen (verschicken Mails) zählen jetzt mit
create or replace function public.mod_rate_check() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select count(*) from public.moderation_log l
      where l.moderator = auth.uid()
        and l.action in ('delete_post', 'delete_comment', 'delete_spot', 'hide_post', 'ban', 'warn')
        and l.created_at > now() - interval '24 hours') >= 50 then
    raise exception 'too_many_actions';
  end if;
end;
$$;

create function public.mod_add_warning(who uuid, reason text, report uuid, post uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  perform public.require_moderator();
  if who = auth.uid() then raise exception 'self'; end if;
  if char_length(btrim(coalesce(reason, ''))) = 0 then raise exception 'no_reason'; end if;
  if not exists (select 1 from public.profiles p where p.id = who) then raise exception 'not_found'; end if;
  perform public.mod_rate_check();
  insert into public.warnings (user_id, reason, report_id, post_id, created_by)
  values (who, btrim(reason), report, post, auth.uid())
  returning id into new_id;
  perform public.mod_log('warn', who, report, reason);
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
    body := jsonb_build_object('warning', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new_id;
end;
$$;
revoke execute on function public.mod_add_warning(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.mod_add_warning(uuid, text, uuid, uuid) to authenticated;

-- Bisherige Funktion (ältere App-Versionen): legt jetzt ebenfalls eine Verwarnung an, Grund ist Pflicht
create or replace function public.mod_warn(who uuid, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.mod_add_warning(who, note, report, null);
end;
$$;

create function public.mod_revoke_warning(warning uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  perform public.require_moderator();
  update public.warnings w set revoked_at = now(), revoked_by = auth.uid(), revoke_note = nullif(btrim(note), '')
  where w.id = warning and w.revoked_at is null
  returning w.user_id into who;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('revoke_warning', who, null, note);
end;
$$;
revoke execute on function public.mod_revoke_warning(uuid, text) from public, anon;
grant execute on function public.mod_revoke_warning(uuid, text) to authenticated;

create function public.mod_user_warnings(who uuid)
returns table (
  id uuid, reason text, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz, revoke_note text,
  report_id uuid, post_id uuid, moderator_name text, active boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select w.id, w.reason, w.created_at, w.expires_at, w.revoked_at, w.revoke_note, w.report_id, w.post_id,
         mp.display_name, w.revoked_at is null and w.expires_at > now()
  from public.warnings w left join public.profiles mp on mp.id = w.created_by
  where w.user_id = who
  order by w.created_at desc
  limit 100;
end;
$$;
revoke execute on function public.mod_user_warnings(uuid) from public, anon;
grant execute on function public.mod_user_warnings(uuid) to authenticated;

-- 2. Kontenliste und Suche --------------------------------------------------------------------------------
-- q leer = alle; Nutzer-ID (UUID) = genau dieses Konto; enthält „@“ mitten im Text = E-Mail (exakt, nur Founder);
-- sonst Teil von Nutzername oder Anzeigename (ein führendes „@“ wird ignoriert).
-- filter: all | reported | warned | banned. Neueste Konten zuerst, 50 je Seite (before = Registrierung der letzten).
create function public.mod_users(q text default '', filter text default 'all', before timestamptz default null)
returns table (
  user_id uuid, username text, display_name text, joined timestamptz, banned boolean, ban_until timestamptz,
  reports_against integer, open_reports integer, active_warnings integer
)
language plpgsql security definer set search_path = '' as $$
declare
  term text := btrim(coalesce(q, ''));
  by_id uuid;
  by_mail uuid;
  mail boolean := false;
begin
  perform public.require_moderator();
  if filter not in ('all', 'reported', 'warned', 'banned') then raise exception 'bad_filter'; end if;
  if char_length(term) > 200 then raise exception 'bad_query'; end if;
  if term ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    by_id := term::uuid;
  elsif term ~ '^[^@\s]+@[^@\s]+$' then
    -- E-Mail-Suche nur für das Founder-Konto (vergeben nur im SQL-Editor); jede Suche steht im Protokoll
    if not exists (select 1 from public.user_badges b where b.user_id = auth.uid() and b.badge = 'founder') then
      raise exception 'email_not_allowed';
    end if;
    mail := true;
    select u.id into by_mail from auth.users u where lower(u.email) = lower(term);
    perform public.mod_log('search_email', by_mail, null, case when by_mail is null then 'kein Treffer' end);
    if by_mail is null then return; end if;
  else
    term := lower(ltrim(term, '@'));
  end if;
  return query
  select p.id, p.username, p.display_name, p.created_at, public.is_banned(p.id), b.until,
         (select count(*)::int from public.reports x where x.target_user = p.id),
         (select count(*)::int from public.reports x where x.target_user = p.id and x.status <> 'done'),
         public.active_warnings(p.id)
  from public.profiles p
  left join public.bans b on b.user_id = p.id
  where (before is null or p.created_at < before)
    and case
          when by_id is not null then p.id = by_id
          when mail then p.id = by_mail
          when term = '' then true
          else position(term in lower(p.username)) > 0 or position(term in lower(p.display_name)) > 0
        end
    and case filter
          when 'reported' then exists (select 1 from public.reports x where x.target_user = p.id)
          when 'warned' then public.active_warnings(p.id) > 0
          when 'banned' then public.is_banned(p.id)
          else true
        end
  order by p.created_at desc
  limit 50;
end;
$$;
revoke execute on function public.mod_users(text, text, timestamptz) from public, anon;
grant execute on function public.mod_users(text, text, timestamptz) to authenticated;

-- Darf dieses Konto per E-Mail suchen? (nur für die Anzeige; entscheiden tut mod_users selbst)
create function public.mod_can_search_email() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_moderator()
     and exists (select 1 from public.user_badges b where b.user_id = auth.uid() and b.badge = 'founder');
$$;
revoke execute on function public.mod_can_search_email() from public, anon;
grant execute on function public.mod_can_search_email() to authenticated;

-- 3. Dauerhafte Sperre nur nach frischer Passwort-Anmeldung -----------------------------------------------
-- Supabase schreibt die Anmeldeart samt Zeitpunkt in das Token (amr: [{method, timestamp}]).
create function public.recent_password_auth(max_age_seconds integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select bool_or(a ->> 'method' = 'password'
                   and (a ->> 'timestamp') ~ '^\d+$'
                   and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - max_age_seconds)
    from jsonb_array_elements(
      case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
  ), false);
$$;
revoke execute on function public.recent_password_auth(integer) from public, anon, authenticated;

create or replace function public.mod_ban(who uuid, days integer, reason text, report uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ends timestamptz := case when days is null then null else now() + make_interval(days => days) end;
  new_event uuid;
begin
  perform public.require_moderator();
  if who = auth.uid() then raise exception 'self'; end if;
  if days is not null and days not between 1 and 365 then raise exception 'bad_days'; end if;
  if char_length(btrim(coalesce(reason, ''))) = 0 then raise exception 'no_reason'; end if;
  if days is null and not public.recent_password_auth(300) then raise exception 'reauth_required'; end if;
  perform public.mod_rate_check();
  insert into public.bans (user_id, reason, until, banned_by) values (who, btrim(reason), ends, auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, until = excluded.until,
    banned_by = excluded.banned_by, created_at = now();
  -- Anmeldung sperren und laufende Anmeldungen beenden (Schreiben verhindert deny_banned_writes sofort)
  update auth.users set banned_until = coalesce(ends, 'infinity'::timestamptz) where id = who;
  delete from auth.sessions where user_id = who;
  perform public.mod_log('ban', who, report,
    case when days is null then 'dauerhaft' else days || ' Tage' end || ': ' || btrim(reason));
  insert into public.ban_events (user_id, kind, until, reason) values (who, 'ban', ends, btrim(reason))
  returning id into new_event;
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
    body := jsonb_build_object('ban_event', new_event),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- 4. Gesperrt = nichts mehr schreiben -----------------------------------------------------------------------
-- Ein Zugangs-Token gilt nach der Sperre noch bis zu 1 Stunde. Damit in dieser Zeit nichts Neues entsteht, lehnt
-- dieser Trigger Schreiben gesperrter Konten ab – gleich über welche Funktion. Moderatoren, die Inhalte gesperrter
-- Personen ändern (z. B. ausblenden), sind nicht betroffen: geprüft wird, wer schreibt, nicht wem es gehört.
create function public.deny_banned_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and public.is_banned(auth.uid()) then raise exception 'banned'; end if;
  return new;
end;
$$;
revoke execute on function public.deny_banned_writes() from public, anon, authenticated;
create trigger zz_deny_banned before insert or update on public.posts
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert or update on public.post_comments
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert on public.post_likes
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert or update on public.shared_spots
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert or update on public.friendships
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert or update on public.group_sessions
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before insert or update on public.group_session_members
  for each row execute function public.deny_banned_writes();
create trigger zz_deny_banned before update on public.profiles
  for each row execute function public.deny_banned_writes();

notify pgrst, 'reload schema';
