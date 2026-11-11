-- Fangpunkt – Mitteilungen in der App (Wunsch Nutzer 2026-11-11): Liste im Feed mit Gefällt mir, Kommentaren, Folgen,
-- Einladungen und Session-Beginn – unabhängig von Push (auch ohne Gerät und bei abgeschalteter Push-Art).
-- Gespeichert werden nur Art, Auslöser, Bezug (ID) und ein kurzer Textauszug – wie bei push_outbox.
-- Nur erweiternd: enqueue_push schreibt zusätzlich hierher, alles andere bleibt wie in trip_start.sql.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
    'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start'
  )),
  actor uuid not null references auth.users (id) on delete cascade,
  ref text,
  excerpt text check (excerpt is null or char_length(excerpt) <= 140),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_dedupe on public.notifications (user_id, kind, actor, ref, created_at);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

-- Eintragen (nur aus enqueue_push). Gleiche Auslöser-Regeln wie bei Push, damit nichts doppelt erscheint:
-- „Gefällt mir“ je Person und Beitrag einmal am Tag, Folgen je Person einmal am Tag, Termin-Einladung je Termin
-- einmal, Antwort-Kommentar je Beitrag höchstens stündlich. Je Konto bleiben höchstens 200 Einträge, höchstens 90 Tage.
create function public.record_notification(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if what not in ('friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
                  'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start') then
    return;
  end if;
  if what = 'like' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'like' and n.actor = who and n.ref is not distinct from target
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'comment_reply' and n.ref is not distinct from target
      and n.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'trip_invite' and n.actor = who and n.ref is not distinct from target
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind in ('friend_request', 'new_follower') and n.actor = who
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.notifications (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140));
  delete from public.notifications n
  where n.user_id = recipient
    and (n.created_at < now() - interval '90 days'
         or n.id in (select o.id from public.notifications o where o.user_id = recipient
                     order by o.created_at desc offset 200));
end;
$$;
revoke execute on function public.record_notification(uuid, text, uuid, text, text) from public, anon, authenticated;

-- enqueue_push wie in trip_start.sql, neu: vor den Push-Prüfungen (Gerät, Einstellungen) wird die Mitteilung für die
-- Liste in der App eingetragen. Nicht an sich selbst, nicht von Gesperrten, nicht zwischen Blockierten.
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
  perform public.record_notification(recipient, what, who, target, snippet);
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

-- Meine Mitteilungen, neueste zuerst (Cursor `before` = created_at der letzten Zeile). Ohne Gesperrte und Blockierte.
-- Bei Beiträgen kommen Verfasser und Zeitpunkt mit, wenn ich den Beitrag sehen darf (für den Link in der App).
create function public.my_notifications(before timestamptz default null, max_rows integer default 30)
returns table (
  id uuid, kind text, actor_id uuid, actor_username text, actor_display_name text, ref text, excerpt text,
  created_at timestamptz, is_read boolean,
  post_author_username text, post_created_at timestamptz, post_is_mine boolean
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor, a.username, a.display_name, n.ref, n.excerpt, n.created_at, n.read_at is not null,
         case when pv.id is not null then pa.username end,
         case when pv.id is not null then pv.created_at end,
         case when pv.id is not null then pv.author_id = auth.uid() end
  from public.notifications n
  join public.profiles a on a.id = n.actor
  left join lateral (
    select p.id, p.author_id, p.created_at from public.posts p
    where n.kind in ('like', 'comment', 'comment_reply')
      and n.ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and p.id = n.ref::uuid
      and (p.author_id = auth.uid() or public.can_see_post_id(p.id))
  ) pv on true
  left join public.profiles pa on pa.id = pv.author_id
  where n.user_id = auth.uid()
    and (before is null or n.created_at < before)
    and not public.is_banned(n.actor)
    and not public.is_blocked_between(auth.uid(), n.actor)
  order by n.created_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 50);
$$;

-- Zahl der ungelesenen (höchstens 100 – die App zeigt ab 10 „9+“)
create function public.unread_notification_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from (
    select 1 from public.notifications n
    where n.user_id = auth.uid() and n.read_at is null
      and not public.is_banned(n.actor)
      and not public.is_blocked_between(auth.uid(), n.actor)
    limit 100
  ) x;
$$;

-- Alle als gelesen markieren (beim Öffnen der Liste)
create function public.mark_notifications_read() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
end;
$$;

revoke execute on function public.my_notifications(timestamptz, integer) from public, anon;
revoke execute on function public.unread_notification_count() from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.my_notifications(timestamptz, integer) to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

notify pgrst, 'reload schema';
