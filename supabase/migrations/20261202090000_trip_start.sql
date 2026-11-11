-- Fangpunkt – Angeltermin mit Einladung und gemeinsamer Start (Wunsch Nutzer 2026-11-11).
-- 1. Beim Anlegen eines Termins kann man Freunde einladen: nur eine Mitteilung (`trip_invite`), der Termin selbst
--    bleibt auf dem Gerät. 2. Startet der Ersteller die Session, wird eine gemeinsame Session angelegt und die
--    Eingeladenen bekommen `trip_start` (Mitteilung + Fenster in der App); die Session des Erstellers startet erst,
--    wenn mindestens eine Person bestätigt hat (Entscheidung Nutzer) – das prüft die App an `group_session_members_list`.
-- Nur erweiternd: es wird nichts gelöscht, bestehende Funktionen bleiben unverändert.

alter table public.group_sessions add column trip_start boolean not null default false;

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test', 'new_follower',
                  'trip_invite', 'trip_start'));

-- enqueue_push wie bisher (follows.sql), neu: trip_invite/trip_start zählen zur Art „Sessions“;
-- eine Terminmitteilung je Person und Termin
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
    if what in ('friend_request', 'friend_accepted', 'new_follower') and not prefs.friends then return; end if;
    if what = 'like' and not prefs.likes then return; end if;
    if what in ('comment', 'comment_reply') and not prefs.comments then return; end if;
    if what = 'spot' and not prefs.spots then return; end if;
    if what in ('session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start')
       and not prefs.sessions then return; end if;
    if what = 'new_post' and not prefs.posts then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'comment_reply' and o.ref = target
      and o.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'trip_invite' and o.actor = who and o.ref = target
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind in ('friend_request', 'new_follower') and o.actor = who
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

-- 1. Einladung zum Termin: nur Freunde (gegenseitiges Folgen), höchstens 9, ohne Blockierte/Gesperrte.
--    `trip` = ID des Termins auf dem Gerät (nur zum Vermeiden doppelter Mitteilungen). Liefert die Zahl Eingeladener.
create function public.invite_to_trip(trip uuid, users uuid[], label text default null, day text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  u uuid;
  n integer := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  foreach u in array coalesce(users[1:9], '{}') loop
    continue when u is null or u = me;
    continue when not public.are_friends(me, u) or public.is_banned(u) or public.is_blocked_between(me, u);
    perform public.enqueue_push(u, 'trip_invite', me, trip::text,
      concat_ws(' · ', nullif(btrim(label), ''), nullif(btrim(day), '')));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 2. Start: gemeinsame Session anlegen (Ersteller sofort dabei) und die Freunde einladen – mit `trip_start` statt
--    `session_invite`. Fehler: 'banned', 'too_many', 'no_invitees' (niemand einladbar)
create function public.start_trip_session(title text default null, water_name text default null, users uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g uuid;
  u uuid;
  n integer := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  if not exists (
    select 1 from unnest(coalesce(users[1:9], '{}')) x
    where x is not null and x <> me and public.are_friends(me, x)
      and not public.is_banned(x) and not public.is_blocked_between(me, x)
  ) then raise exception 'no_invitees'; end if;
  g := public.create_group_session(title, water_name);
  update public.group_sessions set trip_start = true where id = g;
  foreach u in array coalesce(users[1:9], '{}') loop
    continue when u is null or u = me;
    continue when not public.are_friends(me, u) or public.is_banned(u) or public.is_blocked_between(me, u);
    insert into public.group_session_members (session_id, user_id, status)
      values (g, u, 'invited')
    on conflict (session_id, user_id) do nothing;
    perform public.enqueue_push(u, 'trip_start', me, g::text, coalesce(nullif(btrim(title), ''), nullif(btrim(water_name), ''), ''));
    n := n + 1;
  end loop;
  return g;
end;
$$;

-- Offene Start-Anfragen an mich (Fenster in der App): läuft noch (nicht beendet, höchstens 6 Stunden alt)
create function public.my_start_requests()
returns table (
  id uuid, host_id uuid, host_username text, host_display_name text,
  title text, water_name text, started_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.host_id, p.username, p.display_name, g.title, g.water_name, g.created_at
  from public.group_sessions g
  join public.group_session_members m on m.session_id = g.id and m.user_id = auth.uid() and m.status = 'invited'
  join public.profiles p on p.id = g.host_id
  where g.trip_start and g.ended_at is null and g.created_at > now() - interval '6 hours'
    and not public.is_banned(g.host_id) and not public.is_blocked_between(g.host_id, auth.uid())
  order by g.created_at desc;
$$;

revoke execute on function public.invite_to_trip(uuid, uuid[], text, text) from public, anon;
revoke execute on function public.start_trip_session(text, text, uuid[]) from public, anon;
revoke execute on function public.my_start_requests() from public, anon;
grant execute on function public.invite_to_trip(uuid, uuid[], text, text) to authenticated;
grant execute on function public.start_trip_session(text, text, uuid[]) to authenticated;
grant execute on function public.my_start_requests() to authenticated;

notify pgrst, 'reload schema';
