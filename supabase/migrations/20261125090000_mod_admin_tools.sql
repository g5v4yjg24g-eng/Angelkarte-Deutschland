-- Fangpunkt – Admin-Bereich, Verwaltung (Wunsch Nutzer 2026-11-10): Rollen, gesperrte Nutzernamen,
-- Moderationsprotokoll, Statistiken. Nur erweiternd: es wird nichts gelöscht, bestehende Konten bleiben unverändert.

-- Protokoll: weitere Aktionen
alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban',
                    'unban', 'resolve', 'in_progress', 'reopen', 'hide_post', 'restore_post', 'view_reporter',
                    'revoke_warning', 'search_email', 'block_name', 'unblock_name'));
create index moderation_log_time on public.moderation_log (created_at desc);

-- 1. Rollen -----------------------------------------------------------------------------------------------
-- Founder (alle Rechte, z. B. Suche per E-Mail) und Moderator. Vergeben und geändert wird nur im SQL-Editor über die
-- Nutzer-ID – nie aus der App, nie über Profilfelder. Wer heute das Founder-Abzeichen hat und Moderator ist, wird
-- Founder (damit bleibt die E-Mail-Suche wie bisher).
alter table public.moderators
  add column role text not null default 'moderator' check (role in ('founder', 'moderator'));
create unique index moderators_one_founder on public.moderators (role) where role = 'founder';
update public.moderators m set role = 'founder'
where exists (select 1 from public.user_badges b where b.user_id = m.user_id and b.badge = 'founder');

create function public.is_founder() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators m where m.user_id = auth.uid() and m.role = 'founder');
$$;
revoke execute on function public.is_founder() from public, anon;
grant execute on function public.is_founder() to authenticated;

-- Eigene Rolle (null = keine) und alle Moderatoren mit Rolle (nur für Moderatoren)
create function public.mod_my_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.moderators m where m.user_id = auth.uid();
$$;
revoke execute on function public.mod_my_role() from public, anon;
grant execute on function public.mod_my_role() to authenticated;

create function public.mod_roles()
returns table (user_id uuid, username text, display_name text, role text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select m.user_id, p.username, p.display_name, m.role, m.created_at
  from public.moderators m left join public.profiles p on p.id = m.user_id
  order by m.role = 'founder' desc, m.created_at;
end;
$$;
revoke execute on function public.mod_roles() from public, anon;
grant execute on function public.mod_roles() to authenticated;

-- E-Mail-Suche hängt jetzt an der Rolle statt am Abzeichen
create or replace function public.mod_can_search_email() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_founder();
$$;

create or replace function public.mod_users(q text default '', filter text default 'all', before timestamptz default null)
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
    -- E-Mail-Suche nur mit der Rolle Founder; jede Suche steht im Protokoll
    if not public.is_founder() then raise exception 'email_not_allowed'; end if;
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

-- 2. Gesperrte Nutzernamen ------------------------------------------------------------------------------
-- exact = genau dieser Name; contains = Name enthält das Wort. Verglichen wird ohne „.“ und „_“ (so hilft
-- „h.a.s.s“ nicht weiter). Gilt nur für neue Konten – bestehende Nutzernamen bleiben (die Liste zeigt Treffer).
create table public.blocked_usernames (
  pattern text primary key check (pattern ~ '^[a-z0-9]{2,30}$'),
  kind text not null check (kind in ('exact', 'contains')),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.blocked_usernames enable row level security;
revoke all on public.blocked_usernames from anon, authenticated;

create function public.username_key(name text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(btrim(coalesce(name, ''))), '[._]', '', 'g');
$$;

create function public.username_blocked(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocked_usernames b
    where (b.kind = 'exact' and public.username_key(name) = b.pattern)
       or (b.kind = 'contains' and position(b.pattern in public.username_key(name)) > 0));
$$;
revoke execute on function public.username_blocked(text) from public, anon, authenticated;

create function public.profiles_username_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username) and public.username_blocked(new.username) then
    raise exception 'username_blocked';
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_username_guard() from public, anon, authenticated;
create trigger profiles_username_guard before insert or update on public.profiles
  for each row execute function public.profiles_username_guard();

-- Gesperrte Namen gelten als nicht verfügbar (die App sagt „vergeben oder nicht erlaubt“)
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = lower(btrim(name)))
     and not public.username_blocked(name);
$$;

create function public.mod_blocked_usernames()
returns table (pattern text, kind text, note text, created_at timestamptz, moderator_name text, matches integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select b.pattern, b.kind, b.note, b.created_at, mp.display_name,
         (select count(*)::int from public.profiles p
          where (b.kind = 'exact' and public.username_key(p.username) = b.pattern)
             or (b.kind = 'contains' and position(b.pattern in public.username_key(p.username)) > 0))
  from public.blocked_usernames b left join public.profiles mp on mp.id = b.created_by
  order by b.pattern;
end;
$$;
revoke execute on function public.mod_blocked_usernames() from public, anon;
grant execute on function public.mod_blocked_usernames() to authenticated;

create function public.mod_add_blocked_username(pattern text, kind text, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  key text := public.username_key(pattern);
begin
  perform public.require_moderator();
  if key !~ '^[a-z0-9]{2,30}$' then raise exception 'bad_pattern'; end if;
  if kind not in ('exact', 'contains') then raise exception 'bad_kind'; end if;
  insert into public.blocked_usernames (pattern, kind, note, created_by)
  values (key, kind, nullif(btrim(note), ''), auth.uid());
  perform public.mod_log('block_name', null, null, key || ' (' || kind || ')');
exception when unique_violation then
  raise exception 'exists';
end;
$$;
revoke execute on function public.mod_add_blocked_username(text, text, text) from public, anon;
grant execute on function public.mod_add_blocked_username(text, text, text) to authenticated;

create function public.mod_remove_blocked_username(pattern text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  key text := public.username_key(pattern);
begin
  perform public.require_moderator();
  delete from public.blocked_usernames b where b.pattern = key;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('unblock_name', null, null, key);
end;
$$;
revoke execute on function public.mod_remove_blocked_username(text) from public, anon;
grant execute on function public.mod_remove_blocked_username(text) to authenticated;

-- 3. Moderationsprotokoll -----------------------------------------------------------------------------------
-- Alle Einträge, neueste zuerst, 100 je Seite; optional nur eine Aktion
create function public.mod_log_list(what text default null, before timestamptz default null)
returns table (
  id uuid, action text, detail text, created_at timestamptz, moderator_name text, target_user uuid,
  target_name text, target_username text, report_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select l.id, l.action, l.detail, l.created_at, mp.display_name, l.target_user, tp.display_name, tp.username,
         l.report_id
  from public.moderation_log l
  left join public.profiles mp on mp.id = l.moderator
  left join public.profiles tp on tp.id = l.target_user
  where (what is null or l.action = what) and (before is null or l.created_at < before)
  order by l.created_at desc, l.id
  limit 100;
end;
$$;
revoke execute on function public.mod_log_list(text, timestamptz) from public, anon;
grant execute on function public.mod_log_list(text, timestamptz) to authenticated;

-- 4. Statistiken (nur Zahlen, keine Personen) -------------------------------------------------------------
create function public.mod_stats(days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz;
begin
  perform public.require_moderator();
  if days not in (7, 30, 90, 365) then raise exception 'bad_days'; end if;
  since := now() - make_interval(days => days);
  return jsonb_build_object(
    'days', days,
    'reports', (select count(*) from public.reports r where r.created_at >= since),
    'reports_done', (select count(*) from public.reports r where r.created_at >= since and r.status = 'done'),
    'by_reason', coalesce((select jsonb_object_agg(x.reason, x.n) from (
        select r.reason, count(*) n from public.reports r where r.created_at >= since group by r.reason) x), '{}'),
    'by_kind', coalesce((select jsonb_object_agg(x.target_type, x.n) from (
        select r.target_type, count(*) n from public.reports r where r.created_at >= since group by r.target_type) x),
        '{}'),
    -- Median der Bearbeitungszeit (Meldung → erledigt) in Stunden; null, solange nichts erledigt ist
    'median_hours', (select round((percentile_cont(0.5) within group (
        order by extract(epoch from r.handled_at - r.created_at)) / 3600)::numeric, 1)
      from public.reports r where r.created_at >= since and r.status = 'done' and r.handled_at is not null),
    'actions', coalesce((select jsonb_object_agg(x.action, x.n) from (
        select l.action, count(*) n from public.moderation_log l where l.created_at >= since group by l.action) x),
        '{}'),
    'new_users', (select count(*) from public.profiles p where p.created_at >= since),
    'banned_now', (select count(*) from public.bans b where b.until is null or b.until > now()),
    'warned_now', (select count(distinct w.user_id) from public.warnings w
                   where w.revoked_at is null and w.expires_at > now()),
    -- Wochen (Montag, Europe/Berlin), älteste zuerst, höchstens 12
    'weeks', coalesce((select jsonb_agg(jsonb_build_object('week', w.week, 'reports', w.reports,
                                                            'new_users', w.new_users) order by w.week)
      from (
        select gs::date week,
               (select count(*) from public.reports r
                where (r.created_at at time zone 'Europe/Berlin') >= gs
                  and (r.created_at at time zone 'Europe/Berlin') < gs + interval '7 days') reports,
               (select count(*) from public.profiles p
                where (p.created_at at time zone 'Europe/Berlin') >= gs
                  and (p.created_at at time zone 'Europe/Berlin') < gs + interval '7 days') new_users
        from generate_series(
          date_trunc('week', (now() - make_interval(days => least(days, 84))) at time zone 'Europe/Berlin'),
          date_trunc('week', now() at time zone 'Europe/Berlin'), interval '7 days') gs
      ) w), '[]')
  );
end;
$$;
revoke execute on function public.mod_stats(integer) from public, anon;
grant execute on function public.mod_stats(integer) to authenticated;

notify pgrst, 'reload schema';
