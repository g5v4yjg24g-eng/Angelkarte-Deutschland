-- Fangpunkt – Folgen statt Freundschaft (Paket C, Wunsch Nutzer 2026-11-10; Entscheidungen: „Privates Konto“
-- selbst wählbar, Standard privat; Spots und gemeinsame Sessions nur bei gegenseitigem Folgen).
--
-- * Folgen ist einseitig. Bei privatem Konto (Standard) muss die Person bestätigen, sonst gilt es sofort.
-- * „Freunde“ = beide folgen sich gegenseitig (bestätigt). are_friends rechnet ab jetzt so – Spots, gemeinsame
--   Sessions und alles andere, was are_friends nutzt, bleiben damit auf gegenseitiges Folgen beschränkt.
-- * Sichtbarkeit „friends“ an Beiträgen und Erfolgen heißt ab jetzt „Follower“: bestätigte Follower sehen sie.
-- * Bestehende Freundschaften werden gegenseitiges Folgen, offene Anfragen offene Folge-Anfragen.
-- * Die Tabelle friendships bleibt unverändert liegen (nichts wird gelöscht). Die bisherigen Funktionen
--   (send_friend_request, my_friends, user_profile, search_users …) arbeiten weiter – jetzt auf follows –,
--   damit ältere App-Versionen (TestFlight) nicht ausfallen.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabelle und Einstellung
alter table public.profiles add column is_private boolean not null default true;

create table public.follows (
  follower uuid not null references auth.users (id) on delete cascade,
  followee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower, followee),
  check (follower <> followee)
);
create index follows_followee on public.follows (followee, status);
alter table public.follows enable row level security;
create policy "Eigenes Folgen lesen" on public.follows
  for select to authenticated using ((select auth.uid()) in (follower, followee));
revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;
-- gesperrte Konten schreiben nichts (wie *_mod_users.sql)
create trigger zz_deny_banned before insert or update on public.follows
  for each row execute function public.deny_banned_writes();

-- Bestand übernehmen: Freundschaft → beide folgen sich; offene Anfrage → offene Folge-Anfrage
insert into public.follows (follower, followee, status, created_at, accepted_at)
select f.requester, f.addressee, f.status, f.created_at, f.accepted_at from public.friendships f
on conflict do nothing;
insert into public.follows (follower, followee, status, created_at, accepted_at)
select f.addressee, f.requester, 'accepted', f.created_at, f.accepted_at from public.friendships f
where f.status = 'accepted'
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Hilfsfunktionen
-- Folgt `who` bestätigt `whom`?
create function public.is_follower(who uuid, whom uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows f where f.follower = who and f.followee = whom and f.status = 'accepted');
$$;
revoke execute on function public.is_follower(uuid, uuid) from public, anon;
grant execute on function public.is_follower(uuid, uuid) to authenticated;

-- Freunde = gegenseitig bestätigtes Folgen (Spots, gemeinsame Sessions, Mitteilungen dazu)
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a <> b and public.is_follower(a, b) and public.is_follower(b, a);
$$;

-- Sichtbarkeit „friends“ (= Follower): bestätigte Follower der Person
create or replace function public.can_see_post(author uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = auth.uid()
      or (not public.is_banned(author)
          and not public.is_blocked_between(author, auth.uid())
          and (vis = 'public' or (vis = 'friends' and public.is_follower(auth.uid(), author))));
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Folgen, Entfolgen, Anfragen
-- Ergebnis: 'requested' (privat, wartet) | 'following' | 'already'; Fehler: not_found, self, no_profile,
-- too_many_follows (höchstens 200 neue in 24 h)
create function public.follow_user(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  priv boolean;
  existing public.follows;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  select id, is_private into other, priv from public.profiles where username = lower(btrim(name));
  if other is null or public.is_blocked_between(me, other) or public.is_banned(other) then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  select * into existing from public.follows f where f.follower = me and f.followee = other;
  if existing.follower is not null then return 'already'; end if;
  if (select count(*) from public.follows f where f.follower = me and f.created_at > now() - interval '24 hours') >= 200 then
    raise exception 'too_many_follows';
  end if;
  insert into public.follows (follower, followee, status, accepted_at)
    values (me, other, case when priv then 'pending' else 'accepted' end, case when priv then null else now() end);
  return case when priv then 'requested' else 'following' end;
end;
$$;

-- Nicht mehr folgen oder eigene Anfrage zurückziehen
create function public.unfollow_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.follows f where f.follower = auth.uid() and f.followee = other;
end;
$$;

-- Follower entfernen (die Person merkt es nur daran, dass sie nichts mehr sieht)
create function public.remove_follower(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.follows f where f.follower = other and f.followee = auth.uid();
end;
$$;

-- Anfrage bestätigen oder ablehnen (nur die angefragte Person)
create function public.respond_follow_request(other uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if accept then
    update public.follows set status = 'accepted', accepted_at = now()
      where follower = other and followee = auth.uid() and status = 'pending';
  else
    delete from public.follows where follower = other and followee = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Privates Konto an/aus; beim Ausschalten werden offene Anfragen bestätigt (wie bei Instagram)
create function public.set_account_private(v boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v is null then raise exception 'bad_value'; end if;
  update public.profiles set is_private = v where id = auth.uid();
  if not found then raise exception 'no_profile'; end if;
  if not v then
    update public.follows set status = 'accepted', accepted_at = now()
      where followee = auth.uid() and status = 'pending';
  end if;
end;
$$;

create function public.my_account_private() returns boolean
language sql stable security definer set search_path = '' as $$
  select p.is_private from public.profiles p where p.id = auth.uid();
$$;

-- Eigene Follower, Gefolgte und offene Anfragen (in beide Richtungen) mit Name und Abzeichen
-- direction: 'follower' (folgt mir) | 'following' (ich folge); status: pending | accepted
create function public.my_follows()
returns table (
  user_id uuid, username text, display_name text, badges text[], direction text, status text, since timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.id), '{}'),
         case when f.follower = auth.uid() then 'following' else 'follower' end,
         f.status, coalesce(f.accepted_at, f.created_at)
  from public.follows f
  join public.profiles p on p.id = case when f.follower = auth.uid() then f.followee else f.follower end
  where auth.uid() in (f.follower, f.followee)
    and not public.is_blocked_between(p.id, auth.uid())
  order by p.display_name
  limit 2000;
$$;

revoke execute on function public.follow_user(text) from public, anon;
revoke execute on function public.unfollow_user(uuid) from public, anon;
revoke execute on function public.remove_follower(uuid) from public, anon;
revoke execute on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke execute on function public.set_account_private(boolean) from public, anon;
revoke execute on function public.my_account_private() from public, anon;
revoke execute on function public.my_follows() from public, anon;
grant execute on function public.follow_user(text) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.remove_follower(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.set_account_private(boolean) to authenticated;
grant execute on function public.my_account_private() to authenticated;
grant execute on function public.my_follows() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Profil und Suche (neue Fassungen; die alten bleiben für ältere Apps)
-- relation: self | following | requested | none; follows_me: folgt mir bestätigt
-- Angaben (Text, Fischarten …) für sich selbst und bestätigte Follower
create function public.user_profile_v2(name text)
returns table (
  user_id uuid, username text, display_name text, badges text[], relation text, follows_me boolean,
  is_private boolean, follower_count integer, following_count integer,
  bio text, target_species text[], methods text[], region text, highlight_post_ids uuid[]
)
language sql stable security definer set search_path = '' as $$
  with p as (
    select pr.*,
      case
        when pr.id = auth.uid() then 'self'
        else coalesce((
          select case when f.status = 'accepted' then 'following' else 'requested' end
          from public.follows f where f.follower = auth.uid() and f.followee = pr.id
        ), 'none')
      end as rel
    from public.profiles pr
    where auth.uid() is not null
      and pr.username = lower(btrim(name))
      and (pr.id = auth.uid() or (not public.is_blocked_between(pr.id, auth.uid()) and not public.is_banned(pr.id)))
  )
  select p.id, p.username, p.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.id), '{}'),
         p.rel,
         p.id <> auth.uid() and public.is_follower(p.id, auth.uid()),
         p.is_private,
         (select count(*)::integer from public.follows f where f.followee = p.id and f.status = 'accepted'),
         (select count(*)::integer from public.follows f where f.follower = p.id and f.status = 'accepted'),
         case when p.rel in ('self', 'following') then p.bio end,
         case when p.rel in ('self', 'following') then p.target_species end,
         case when p.rel in ('self', 'following') then p.methods end,
         case when p.rel in ('self', 'following') then p.region end,
         case when p.rel in ('self', 'following') then (
           select array_agg(x.h order by x.o)
           from unnest(p.highlight_post_ids) with ordinality as x(h, o)
           join public.posts po on po.id = x.h
           where public.can_see_post(po.author_id, po.visibility, po.group_session_id)
         ) end
  from p;
$$;
revoke execute on function public.user_profile_v2(text) from public, anon;
grant execute on function public.user_profile_v2(text) to authenticated;

-- Eigene Zahlen (Profilseite)
create function public.my_follow_counts()
returns table (followers integer, following integer, requests integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::integer from public.follows f where f.followee = auth.uid() and f.status = 'accepted'),
         (select count(*)::integer from public.follows f where f.follower = auth.uid() and f.status = 'accepted'),
         (select count(*)::integer from public.follows f where f.followee = auth.uid() and f.status = 'pending');
$$;
revoke execute on function public.my_follow_counts() from public, anon;
grant execute on function public.my_follow_counts() to authenticated;

-- Suche wie bisher, Beziehung in der neuen Form
create function public.search_users_v2(q text)
returns table (user_id uuid, username text, display_name text, badges text[], relation text, follows_me boolean)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  term text := lower(btrim(coalesce(q, '')));
  pattern text;
  used integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(term) < 3 or char_length(term) > 40 then return; end if;
  insert into public.user_search_counts as c (user_id, day, n) values (me, current_date, 1)
    on conflict on constraint user_search_counts_pkey do update set n = c.n + 1
    returning c.n into used;
  if used > 300 then raise exception 'too_many_searches'; end if;
  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select pr.id, pr.username, pr.display_name,
           coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = pr.id), '{}'),
           coalesce((
             select case when f.status = 'accepted' then 'following' else 'requested' end
             from public.follows f where f.follower = me and f.followee = pr.id
           ), 'none'),
           public.is_follower(pr.id, me)
    from public.profiles pr
    where pr.id <> me
      and (pr.username like pattern || '%' or lower(pr.display_name) like '%' || pattern || '%')
      and not public.is_blocked_between(pr.id, me)
      and not public.is_banned(pr.id)
    order by (pr.username = term) desc, (pr.username like pattern || '%') desc, pr.username
    limit 20;
end;
$$;
revoke execute on function public.search_users_v2(text) from public, anon;
grant execute on function public.search_users_v2(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Feed, Erfolge, Blockieren auf Folgen umstellen
create or replace function public.feed(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], caption text, visibility text,
  photo_paths text[], created_at timestamptz, species_id text, length_cm numeric,
  group_session_id uuid, group_title text
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at, p.species_id, p.length_cm,
         p.group_session_id, coalesce(g.title, g.water_name)
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.group_sessions g on g.id = p.group_session_id
  where auth.uid() is not null
    and (
      (p.group_session_id is null
        and (p.author_id = auth.uid()
             or (p.visibility in ('friends', 'public')
                 and public.is_follower(auth.uid(), p.author_id)
                 and not public.is_banned(p.author_id)
                 and not public.is_blocked_between(p.author_id, auth.uid()))))
      or (p.group_session_id is not null and public.can_see_post(p.author_id, p.visibility, p.group_session_id))
    )
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Erfolge: „friends“ = bestätigte Follower
create or replace function public.user_achievements(author uuid)
returns table (visible boolean, key text, unlocked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  vis text;
  ok boolean;
begin
  if auth.uid() is null then return; end if;
  select p.achievements_visibility into vis from public.profiles p where p.id = author;
  if not found then return; end if;
  ok := author = auth.uid()
     or (not public.is_blocked_between(author, auth.uid()) and not public.is_banned(author)
         and (vis = 'public' or (vis = 'friends' and public.is_follower(auth.uid(), author))));
  if not ok then
    return query select false, null::text, null::timestamptz;
    return;
  end if;
  return query
  select true, a.key, a.unlocked_at from public.user_achievements a where a.user_id = author order by a.unlocked_at;
  if not found then return query select true, null::text, null::timestamptz; end if;
end;
$$;

-- Blockieren beendet das Folgen in beide Richtungen (und alte Freundschaftszeilen wie bisher)
create or replace function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if other is null or other = me then raise exception 'self'; end if;
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
  delete from public.follows f where (f.follower = me and f.followee = other) or (f.follower = other and f.followee = me);
  delete from public.friendships f
    where least(f.requester, f.addressee) = least(me, other)
      and greatest(f.requester, f.addressee) = greatest(me, other);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Mitteilungen: Anfrage (friend_request), bestätigt (friend_accepted), neuer Follower (new_follower)
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test', 'new_follower'));

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
    if what in ('session_invite', 'session_joined', 'session_highlight') and not prefs.sessions then return; end if;
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
  -- Folgen/Entfolgen im Wechsel: höchstens eine Mitteilung je Person und Tag
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

create function public.push_on_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.enqueue_push(new.followee, 'friend_request', new.follower, null, null);
  elsif tg_op = 'INSERT' and new.status = 'accepted' then
    perform public.enqueue_push(new.followee, 'new_follower', new.follower, null, null);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.enqueue_push(new.follower, 'friend_accepted', new.followee, null, null);
  end if;
  return new;
end;
$$;
revoke execute on function public.push_on_follow() from public, anon, authenticated;
create trigger follows_push after insert or update on public.follows
  for each row execute function public.push_on_follow();

-- Neuer Beitrag: an bestätigte Follower (Highlights weiter an die Teilnehmer)
create or replace function public.push_on_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
begin
  if new.visibility = 'private' or new.created_at < now() - interval '1 day' then return new; end if;
  if new.group_session_id is null then
    for r in
      select f.follower from public.follows f where f.followee = new.author_id and f.status = 'accepted'
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

-- Weitere Kommentare: nur an Leute, die den Beitrag noch sehen dürfen (Follower, „Alle“ oder Teilnehmer)
create or replace function public.push_on_comment_reply() returns trigger
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
    if post.visibility = 'public'
       or (post.visibility = 'friends' and public.is_follower(r, post.author_id))
       or (post.group_session_id is not null and public.is_group_participant(post.group_session_id, r)) then
      perform public.enqueue_push(r, 'comment_reply', new.author_id, new.post_id::text, new.body);
    end if;
  end loop;
  return new;
end;
$$;

-- Spot an „alle Freunde“: an alle, mit denen man sich gegenseitig folgt
create or replace function public.push_on_spot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  friend uuid;
begin
  if new.recipient_id is not null then
    perform public.enqueue_push(new.recipient_id, 'spot', new.owner_id, new.id::text, new.name);
  else
    for friend in
      select f.followee from public.follows f
      where f.follower = new.owner_id and f.status = 'accepted' and public.is_follower(f.followee, new.owner_id)
    loop
      perform public.enqueue_push(friend, 'spot', new.owner_id, new.id::text, new.name);
    end loop;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Bisherige Funktionen für ältere App-Versionen – gleiche Form, jetzt auf follows.
-- „Freundschaft“ = gegenseitiges Folgen; request_id ist ab jetzt die Nutzer-ID der anderen Person.
create or replace function public.send_friend_request(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  r text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into other from public.profiles where username = lower(btrim(name));
  r := public.follow_user(name);
  -- hat die andere Person schon angefragt, gilt das (wie früher) als Annahme
  update public.follows set status = 'accepted', accepted_at = now()
    where follower = other and followee = me and status = 'pending';
  if public.are_friends(me, other) then return 'accepted'; end if;
  return case when r = 'already' then 'already' else 'sent' end;
end;
$$;

create or replace function public.respond_friend_request(request uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  perform public.respond_follow_request(request, accept);
  -- früher war eine angenommene Anfrage gegenseitig: zurückfolgen
  if accept then
    insert into public.follows (follower, followee, status, accepted_at) values (me, request, 'accepted', now())
    on conflict (follower, followee) do update set status = 'accepted', accepted_at = coalesce(public.follows.accepted_at, now());
  end if;
end;
$$;

create or replace function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.follows f where (f.follower = me and f.followee = other) or (f.follower = other and f.followee = me);
end;
$$;

create or replace function public.my_friends()
returns table (
  request_id uuid, user_id uuid, username text, display_name text, status text, direction text, badges text[],
  since timestamptz
)
language sql stable security definer set search_path = '' as $$
  with rel as (
    select o.id as other,
           public.is_follower(auth.uid(), o.id) as i_follow,
           public.is_follower(o.id, auth.uid()) as follows_me,
           exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = o.id) as i_any,
           exists (select 1 from public.follows f where f.follower = o.id and f.followee = auth.uid() and f.status = 'pending') as asks_me,
           (select max(coalesce(f.accepted_at, f.created_at)) from public.follows f
              where (f.follower = auth.uid() and f.followee = o.id) or (f.follower = o.id and f.followee = auth.uid())) as since
    from (select distinct case when f.follower = auth.uid() then f.followee else f.follower end as id
          from public.follows f where auth.uid() in (f.follower, f.followee)) o
  )
  select r.other, p.id, p.username, p.display_name,
         case when r.i_follow and r.follows_me then 'accepted' else 'pending' end,
         case when r.i_follow and r.follows_me then 'outgoing' when r.asks_me or (r.follows_me and not r.i_any) then 'incoming' else 'outgoing' end,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.id), '{}'),
         r.since
  from rel r join public.profiles p on p.id = r.other
  where not public.is_blocked_between(p.id, auth.uid())
  order by p.display_name;
$$;

create or replace function public.user_profile(name text)
returns table (
  user_id uuid, username text, display_name text, badges text[], relation text, friend_count integer,
  bio text, target_species text[], methods text[], region text, highlight_post_ids uuid[]
)
language sql stable security definer set search_path = '' as $$
  select v.user_id, v.username, v.display_name, v.badges,
         case when v.relation = 'self' then 'self'
              when v.relation = 'following' and v.follows_me then 'friend'
              when v.relation in ('following', 'requested') then 'outgoing'
              when v.follows_me then 'incoming'
              else 'none' end,
         (select count(*)::integer from public.follows f
            where f.followee = v.user_id and f.status = 'accepted' and public.is_follower(v.user_id, f.follower)),
         v.bio, v.target_species, v.methods, v.region, v.highlight_post_ids
  from public.user_profile_v2(name) v;
$$;

create or replace function public.search_users(q text)
returns table (user_id uuid, username text, display_name text, badges text[], relation text)
language sql security definer set search_path = '' as $$
  select v.user_id, v.username, v.display_name, v.badges,
         case when v.relation = 'following' and v.follows_me then 'friend'
              when v.relation in ('following', 'requested') then 'outgoing'
              when v.follows_me then 'incoming'
              else 'none' end
  from public.search_users_v2(q) v;
$$;

notify pgrst, 'reload schema';
