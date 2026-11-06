-- Fangpunkt – Gemeinsame Sessions, Schritt 8a (Freigabe Nutzer 2026-11-06): Einladen nur von Freunden, höchstens
-- 10 Teilnehmer. Jeder behält seine eigene Session auf dem Gerät – der Server kennt nur Titel, optional den
-- Gewässernamen (Text, ohne Koordinaten), Zeiten und wer dabei ist. Keine Positionen, keine Routen, keine Fänge.
-- Tabellen nur über Funktionen lesbar und schreibbar. Nur hinzufügend.

create table public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  water_name text check (water_name is null or char_length(water_name) <= 120),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_sessions_host on public.group_sessions (host_id, created_at desc);

create table public.group_session_members (
  session_id uuid not null references public.group_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('invited', 'joined', 'declined', 'left')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (session_id, user_id)
);
create index group_session_members_user on public.group_session_members (user_id, status);

alter table public.group_sessions enable row level security;
alter table public.group_session_members enable row level security;
revoke all on public.group_sessions from anon, authenticated;
revoke all on public.group_session_members from anon, authenticated;

-- Höchstzahl: Gastgeber + eingeladene + dabei
create function public.group_session_size(session uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.group_session_members m
  where m.session_id = session and m.status in ('invited', 'joined');
$$;
revoke execute on function public.group_session_size(uuid) from public, anon, authenticated;

-- Anlegen (der Gastgeber ist sofort dabei). Fehler: 'banned', 'too_many' (mehr als 10 in 24 Stunden)
create function public.create_group_session(title text default null, water_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  if (select count(*) from public.group_sessions g
      where g.host_id = me and g.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'too_many';
  end if;
  insert into public.group_sessions (host_id, title, water_name)
    values (me, nullif(btrim(title), ''), nullif(btrim(water_name), ''))
  returning id into new_id;
  insert into public.group_session_members (session_id, user_id, status, responded_at)
    values (new_id, me, 'joined', now());
  return new_id;
end;
$$;

-- Freunde einladen (nur Gastgeber, nur Freunde, höchstens 10 insgesamt). Liefert die Zahl neu Eingeladener.
-- Wer abgelehnt hat, wird nicht erneut eingeladen; wer gegangen ist, schon. Fehler: 'not_found', 'ended',
-- 'too_many_members', 'banned'
create function public.invite_to_group_session(session uuid, users uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.group_sessions;
  u uuid;
  n integer := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  select * into g from public.group_sessions where id = session and host_id = me;
  if g.id is null then raise exception 'not_found'; end if;
  if g.ended_at is not null then raise exception 'ended'; end if;
  foreach u in array coalesce(users[1:20], '{}') loop
    continue when u is null or u = me;
    continue when not public.are_friends(me, u) or public.is_banned(u) or public.is_blocked_between(me, u);
    continue when exists (
      select 1 from public.group_session_members m
      where m.session_id = session and m.user_id = u and m.status in ('invited', 'joined', 'declined')
    );
    if public.group_session_size(session) >= 10 then raise exception 'too_many_members'; end if;
    insert into public.group_session_members (session_id, user_id, status)
      values (session, u, 'invited')
    on conflict (session_id, user_id) do update set status = 'invited', invited_at = now(), responded_at = null;
    perform public.enqueue_push(u, 'session_invite', me, session::text, coalesce(g.title, g.water_name, ''));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Einladung beantworten. Fehler: 'not_found' (keine offene Einladung), 'ended'
create function public.respond_group_invite(session uuid, accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.group_session_members
                 where session_id = session and user_id = me and status = 'invited') then
    raise exception 'not_found';
  end if;
  if accept and exists (select 1 from public.group_sessions where id = session and ended_at is not null) then
    raise exception 'ended';
  end if;
  update public.group_session_members
    set status = case when accept then 'joined' else 'declined' end, responded_at = now()
    where session_id = session and user_id = me;
end;
$$;

-- Verlassen (nicht der Gastgeber – der beendet). Fehler: 'not_found', 'host'
create function public.leave_group_session(session uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.group_sessions where id = session and host_id = me) then
    raise exception 'host';
  end if;
  update public.group_session_members set status = 'left', responded_at = now()
    where session_id = session and user_id = me and status in ('invited', 'joined');
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Beenden (nur Gastgeber; danach keine Einladungen und Zusagen mehr). Fehler: 'not_found'
create function public.end_group_session(session uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.group_sessions set ended_at = coalesce(ended_at, now())
    where id = session and host_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Meine gemeinsamen Sessions (eingeladen, dabei oder gegangen), neueste zuerst
create function public.my_group_sessions()
returns table (
  id uuid, host_id uuid, host_username text, host_display_name text, title text, water_name text,
  started_at timestamptz, ended_at timestamptz, my_status text, joined_count integer
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.host_id, pr.username, pr.display_name, g.title, g.water_name, g.started_at, g.ended_at, m.status,
         (select count(*)::int from public.group_session_members x where x.session_id = g.id and x.status = 'joined')
  from public.group_session_members m
  join public.group_sessions g on g.id = m.session_id
  join public.profiles pr on pr.id = g.host_id
  where m.user_id = auth.uid()
    and m.status in ('invited', 'joined', 'left')
    and (g.host_id = auth.uid()
         or (not public.is_banned(g.host_id) and not public.is_blocked_between(g.host_id, auth.uid())))
  order by g.started_at desc
  limit 50;
$$;

-- Teilnehmer einer Session (nur für Teilnehmer; Abgelehnte sieht nur der Gastgeber; ohne Blockierte)
create function public.group_session_members_list(session uuid)
returns table (user_id uuid, username text, display_name text, status text, is_host boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id, pr.username, pr.display_name, m.status, m.user_id = g.host_id
  from public.group_session_members m
  join public.group_sessions g on g.id = m.session_id
  join public.profiles pr on pr.id = m.user_id
  where m.session_id = session
    and exists (select 1 from public.group_session_members me
                where me.session_id = session and me.user_id = auth.uid() and me.status in ('invited', 'joined', 'left'))
    and (m.status <> 'declined' or g.host_id = auth.uid())
    and (m.user_id = auth.uid() or not public.is_blocked_between(m.user_id, auth.uid()))
  order by (m.user_id = g.host_id) desc, m.invited_at;
$$;

revoke execute on function public.create_group_session(text, text) from public, anon;
revoke execute on function public.invite_to_group_session(uuid, uuid[]) from public, anon;
revoke execute on function public.respond_group_invite(uuid, boolean) from public, anon;
revoke execute on function public.leave_group_session(uuid) from public, anon;
revoke execute on function public.end_group_session(uuid) from public, anon;
revoke execute on function public.my_group_sessions() from public, anon;
revoke execute on function public.group_session_members_list(uuid) from public, anon;
grant execute on function public.create_group_session(text, text) to authenticated;
grant execute on function public.invite_to_group_session(uuid, uuid[]) to authenticated;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_group_session(uuid) to authenticated;
grant execute on function public.end_group_session(uuid) to authenticated;
grant execute on function public.my_group_sessions() to authenticated;
grant execute on function public.group_session_members_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Mitteilung „Einladung zur Session“ – eigene Art, einzeln abschaltbar (fehlt die Einstellung: an)
alter table public.push_prefs add column sessions boolean not null default true;
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite'));

-- Ältere App-Versionen rufen ohne „sessions“ auf – dann bleibt der gespeicherte Wert
drop function public.set_push_prefs(boolean, boolean, boolean, boolean);
create function public.set_push_prefs(
  friends boolean, likes boolean, comments boolean, spots boolean, sessions boolean default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_prefs as p (user_id, friends, likes, comments, spots, sessions)
    values (auth.uid(), friends, likes, comments, spots, coalesce(sessions, true))
  on conflict (user_id) do update
    set friends = excluded.friends, likes = excluded.likes, comments = excluded.comments,
        spots = excluded.spots, sessions = coalesce(set_push_prefs.sessions, p.sessions), updated_at = now();
end;
$$;

drop function public.my_push_prefs();
create function public.my_push_prefs()
returns table (friends boolean, likes boolean, comments boolean, spots boolean, sessions boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.friends, true), coalesce(p.likes, true), coalesce(p.comments, true), coalesce(p.spots, true),
         coalesce(p.sessions, true)
  from (select auth.uid() as id) me
  left join public.push_prefs p on p.user_id = me.id
  where me.id is not null;
$$;

revoke execute on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.my_push_prefs() from public, anon;
grant execute on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.my_push_prefs() to authenticated;

-- wie in *_moderators.sql, dazu die neue Art
create or replace function public.enqueue_push(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prefs public.push_prefs;
  new_id uuid;
begin
  if recipient is null or who is null or recipient = who then return; end if;
  if public.is_banned(who) then return; end if;
  if public.is_blocked_between(recipient, who) then return; end if;
  if not exists (select 1 from public.push_devices d where d.user_id = recipient) then return; end if;
  select * into prefs from public.push_prefs p where p.user_id = recipient;
  if prefs.user_id is not null then
    if what in ('friend_request', 'friend_accepted') and not prefs.friends then return; end if;
    if what = 'like' and not prefs.likes then return; end if;
    if what = 'comment' and not prefs.comments then return; end if;
    if what = 'spot' and not prefs.spots then return; end if;
    if what = 'session_invite' and not prefs.sessions then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.push_outbox (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140))
  returning id into new_id;
  perform net.http_post(
    url := public.push_function_url(),
    body := jsonb_build_object('id', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;
revoke execute on function public.enqueue_push(uuid, text, uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
