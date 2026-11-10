-- Fangpunkt – Mehr Push-Mitteilungen (Wunsch Nutzer 2026-11-10: „für alles eine Benachrichtigung“):
--   new_post          neuer Beitrag eines Freundes            (neue Art „posts“, abschaltbar)
--   comment_reply     weiterer Kommentar unter einem Beitrag, den man selbst kommentiert hat   (Art „comments“)
--   session_joined    jemand hat die Einladung zur gemeinsamen Session angenommen (an den Gastgeber, „sessions“)
--   session_highlight neues Highlight in einer gemeinsamen Session (an die Teilnehmer, „sessions“)
--   test              Test-Mitteilung an sich selbst (Einstellungen → Mitteilungen → „Test senden“)
-- Dazu: Stand der Mitteilungen für das eigene Konto (Geräte, letzter Test) – damit die App zeigt, woran es hakt.
-- Nur hinzufügend; bestehende Funktionen werden ersetzt bzw. um die neue Art ergänzt.

alter table public.push_prefs add column posts boolean not null default true;
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test'));

-- Einstellungen: ältere App-Versionen rufen ohne „posts“ auf – dann bleibt der gespeicherte Wert
drop function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean);
create function public.set_push_prefs(
  friends boolean, likes boolean, comments boolean, spots boolean,
  sessions boolean default null, posts boolean default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_prefs as p (user_id, friends, likes, comments, spots, sessions, posts)
    values (auth.uid(), friends, likes, comments, spots, coalesce(sessions, true), coalesce(posts, true))
  on conflict (user_id) do update
    set friends = excluded.friends, likes = excluded.likes, comments = excluded.comments,
        spots = excluded.spots, sessions = coalesce(set_push_prefs.sessions, p.sessions),
        posts = coalesce(set_push_prefs.posts, p.posts), updated_at = now();
end;
$$;

drop function public.my_push_prefs();
create function public.my_push_prefs()
returns table (friends boolean, likes boolean, comments boolean, spots boolean, sessions boolean, posts boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.friends, true), coalesce(p.likes, true), coalesce(p.comments, true), coalesce(p.spots, true),
         coalesce(p.sessions, true), coalesce(p.posts, true)
  from (select auth.uid() as id) me
  left join public.push_prefs p on p.user_id = me.id
  where me.id is not null;
$$;

revoke execute on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.my_push_prefs() from public, anon;
grant execute on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.my_push_prefs() to authenticated;

-- Einreihen (wie bisher, dazu die neuen Arten)
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
    if what in ('comment', 'comment_reply') and not prefs.comments then return; end if;
    if what = 'spot' and not prefs.spots then return; end if;
    if what in ('session_invite', 'session_joined', 'session_highlight') and not prefs.sessions then return; end if;
    if what = 'new_post' and not prefs.posts then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  -- Kommentar-Verlauf: höchstens eine Mitteilung je Beitrag und Stunde
  if what = 'comment_reply' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'comment_reply' and o.ref = target
      and o.created_at > now() - interval '1 hour'
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

-- Neuer Beitrag: Freunde (normaler Beitrag) bzw. Teilnehmer der gemeinsamen Session (Highlight)
create function public.push_on_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
begin
  if new.group_session_id is null then
    for r in
      select case when f.requester = new.author_id then f.addressee else f.requester end
      from public.friendships f
      where f.status = 'accepted' and new.author_id in (f.requester, f.addressee)
    loop
      perform public.enqueue_push(r, 'new_post', new.author_id, new.id::text, new.caption);
    end loop;
  else
    for r in
      select m.user_id from public.group_session_members m
      where m.session_id = new.group_session_id and m.status in ('joined', 'left')
      union
      select g.host_id from public.group_sessions g where g.id = new.group_session_id
    loop
      perform public.enqueue_push(r, 'session_highlight', new.author_id, new.group_session_id::text,
        (select coalesce(g.title, g.water_name) from public.group_sessions g where g.id = new.group_session_id));
    end loop;
  end if;
  return new;
end;
$$;
create trigger posts_push after insert on public.posts
  for each row execute function public.push_on_post();

-- Weiterer Kommentar: an alle, die vorher kommentiert haben (ohne Verfasser des Beitrags – der bekommt „comment“ –
-- und ohne den Schreibenden), nur solange sie den Beitrag noch sehen dürften (Freunde, „Alle“ oder Teilnehmer)
create function public.push_on_comment_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  post public.posts;
  r uuid;
begin
  select * into post from public.posts p where p.id = new.post_id;
  if post.id is null then return new; end if;
  for r in
    select distinct c.author_id from public.post_comments c
    where c.post_id = new.post_id and c.author_id <> new.author_id and c.author_id <> post.author_id
    limit 30
  loop
    if post.visibility = 'public' or public.are_friends(r, post.author_id)
       or (post.group_session_id is not null and public.is_group_participant(post.group_session_id, r)) then
      perform public.enqueue_push(r, 'comment_reply', new.author_id, new.post_id::text, new.body);
    end if;
  end loop;
  return new;
end;
$$;
create trigger post_comments_reply_push after insert on public.post_comments
  for each row execute function public.push_on_comment_reply();

-- Zusage zur gemeinsamen Session: an den Gastgeber
create function public.push_on_group_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'invited' and new.status = 'joined' then
    perform public.enqueue_push(
      (select g.host_id from public.group_sessions g where g.id = new.session_id),
      'session_joined', new.user_id, new.session_id::text,
      (select coalesce(g.title, g.water_name) from public.group_sessions g where g.id = new.session_id));
  end if;
  return new;
end;
$$;
create trigger group_members_push after update on public.group_session_members
  for each row execute function public.push_on_group_join();

revoke execute on function public.push_on_post() from public, anon, authenticated;
revoke execute on function public.push_on_comment_reply() from public, anon, authenticated;
revoke execute on function public.push_on_group_join() from public, anon, authenticated;

-- Test-Mitteilung an sich selbst (höchstens 10 je Stunde). Liefert die Zahl der angemeldeten Geräte (0 = dieses
-- iPhone ist noch nicht für Mitteilungen angemeldet – dann wird nichts verschickt).
create function public.send_test_push() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n integer;
  new_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select count(*) into n from public.push_devices d where d.user_id = me;
  if n = 0 then return 0; end if;
  if (select count(*) from public.push_outbox o
      where o.user_id = me and o.kind = 'test' and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_tests';
  end if;
  insert into public.push_outbox (user_id, kind, actor) values (me, 'test', me) returning id into new_id;
  perform net.http_post(
    url := public.push_function_url(),
    body := jsonb_build_object('id', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return n;
end;
$$;

-- Stand für das eigene Konto: angemeldete Geräte und Ergebnis des letzten Tests (verschickt? Fehler von Apple?)
create function public.my_push_status()
returns table (devices integer, test_at timestamptz, test_sent_at timestamptz, test_error text)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::integer from public.push_devices d where d.user_id = auth.uid()),
         t.created_at, t.sent_at, t.error
  from (select auth.uid() as id) me
  left join lateral (
    select o.created_at, o.sent_at, o.error from public.push_outbox o
    where o.user_id = me.id and o.kind = 'test' order by o.created_at desc limit 1
  ) t on true
  where me.id is not null;
$$;

revoke execute on function public.send_test_push() from public, anon;
revoke execute on function public.my_push_status() from public, anon;
grant execute on function public.send_test_push() to authenticated;
grant execute on function public.my_push_status() to authenticated;

notify pgrst, 'reload schema';
