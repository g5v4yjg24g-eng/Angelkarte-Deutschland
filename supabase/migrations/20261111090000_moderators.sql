-- Fangpunkt – Moderationsbereich (Plan: MODERATION_PLAN.md, Variante A; Entscheidungen Nutzer 2026-11-04:
-- Sperren befristet oder dauerhaft, Mail an die Person beim Sperren und Aufheben, Sperre jederzeit aufhebbar –
-- deshalb blendet eine Sperre nur aus und löscht nichts).
-- Wer moderiert, entscheidet ausschließlich diese Datenbank: Eintrag in `moderators` nur durch den
-- Datenbank-Eigentümer im SQL-Editor über die Nutzer-ID (nie im Repo). Jede Funktion prüft is_moderator() selbst.

-- ---------------------------------------------------------------------------------------------------------
create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "Eigenen Eintrag lesen" on public.moderators
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.moderators from anon, authenticated;
grant select on public.moderators to authenticated;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators m where m.user_id = auth.uid());
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Sperren: eine Zeile je gesperrtem Konto; until null = dauerhaft. Aufheben löscht die Zeile.
create table public.bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  until timestamptz,
  banned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

create function public.is_banned(who uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bans b where b.user_id = who and (b.until is null or b.until > now()));
$$;
revoke execute on function public.is_banned(uuid) from public, anon;
grant execute on function public.is_banned(uuid) to authenticated;

-- Protokoll jeder Moderations-Aktion
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  moderator uuid references auth.users (id) on delete set null,
  action text not null check (action in ('delete_post', 'delete_comment', 'delete_spot', 'warn', 'ban', 'unban', 'resolve')),
  target_user uuid references auth.users (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  detail text check (detail is null or char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);
create index moderation_log_target on public.moderation_log (target_user, created_at desc);
alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;

-- Mails an gesperrte Personen (Edge Function notify-report, Adresse hyper-function, Art „ban“/„unban“)
create table public.ban_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ban', 'unban')),
  until timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.ban_events enable row level security;
revoke all on public.ban_events from anon, authenticated;
grant select, update (notified_at) on public.ban_events to service_role;

create function public.mod_log(what text, who uuid, report uuid, note text) returns void
language sql security definer set search_path = '' as $$
  insert into public.moderation_log (moderator, action, target_user, report_id, detail)
  values (auth.uid(), what, who, report, nullif(btrim(note), ''));
$$;
revoke execute on function public.mod_log(text, uuid, uuid, text) from public, anon, authenticated;

create function public.require_moderator() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
end;
$$;
revoke execute on function public.require_moderator() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Lesen für Moderatoren
create function public.mod_reports(state text default 'open')
returns table (
  id uuid, target_type text, target_id text, reason text, details text, status text, created_at timestamptz,
  reporter uuid, reporter_name text, target_user uuid, target_name text, target_username text,
  target_banned boolean, open_against integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
         r.reporter, rp.display_name, r.target_user, tp.display_name, tp.username,
         public.is_banned(r.target_user),
         (select count(*)::int from public.reports x where x.target_user = r.target_user and x.status = 'open')
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter
  left join public.profiles tp on tp.id = r.target_user
  where state = 'all' or r.status = state
  order by r.created_at desc
  limit 200;
end;
$$;

-- Inhalt hinter einer Meldung (Beitrag, Kommentar, Spot); fehlt er, ist er schon gelöscht
create function public.mod_content(kind text, target text)
returns table (exists_now boolean, author uuid, body text, photo_paths text[], post_id uuid, extra text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  if kind = 'post' then
    return query select true, p.author_id, p.caption, p.photo_paths, p.id, p.visibility, p.created_at
      from public.posts p where p.id::text = target;
  elsif kind = 'comment' then
    return query select true, c.author_id, c.body, p.photo_paths, c.post_id, p.caption, c.created_at
      from public.post_comments c left join public.posts p on p.id = c.post_id where c.id::text = target;
  elsif kind = 'spot' then
    return query select true, s.owner_id, s.note, null::text[], null::uuid, s.name, s.updated_at
      from public.shared_spots s where s.id::text = target;
  end if;
end;
$$;

-- Ein Konto im Überblick: Name, Sperre, Zahlen
create function public.mod_user(who uuid)
returns table (
  user_id uuid, username text, display_name text, banned boolean, ban_until timestamptz, ban_reason text,
  posts integer, comments integer, spots integer, reports_against integer, joined timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select p.id, p.username, p.display_name, public.is_banned(p.id), b.until, b.reason,
         (select count(*)::int from public.posts x where x.author_id = p.id),
         (select count(*)::int from public.post_comments x where x.author_id = p.id),
         (select count(*)::int from public.shared_spots x where x.owner_id = p.id),
         (select count(*)::int from public.reports x where x.target_user = p.id),
         p.created_at
  from public.profiles p
  left join public.bans b on b.user_id = p.id
  where p.id = who;
end;
$$;

-- Alles, was ein Konto geteilt hat (neueste zuerst): Beiträge, Kommentare, Spots
create function public.mod_user_content(who uuid)
returns table (kind text, id text, body text, photo_paths text[], post_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select * from (
    select 'post'::text, p.id::text, p.caption, p.photo_paths, p.id, p.created_at
      from public.posts p where p.author_id = who
    union all
    select 'comment', c.id::text, c.body, null::text[], c.post_id, c.created_at
      from public.post_comments c where c.author_id = who
    union all
    select 'spot', s.id::text, coalesce(s.name, '') || coalesce(' – ' || s.note, ''), null::text[], null::uuid, s.updated_at
      from public.shared_spots s where s.owner_id = who
  ) x
  order by 6 desc
  limit 300;
end;
$$;

-- Protokoll zu einem Konto
create function public.mod_user_log(who uuid)
returns table (action text, detail text, created_at timestamptz, moderator_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select l.action, l.detail, l.created_at, mp.display_name
  from public.moderation_log l left join public.profiles mp on mp.id = l.moderator
  where l.target_user = who order by l.created_at desc limit 100;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Aktionen (jede mit Protokoll)

-- Inhalt löschen. Fotos eines Beitrags entfernt die App vorher über den Speicher (Moderatoren dürfen das).
create function public.mod_delete_content(kind text, target text, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  perform public.require_moderator();
  if kind = 'post' then
    delete from public.posts where id::text = target returning author_id into owner;
  elsif kind = 'comment' then
    delete from public.post_comments where id::text = target returning author_id into owner;
  elsif kind = 'spot' then
    delete from public.shared_spots where id::text = target returning owner_id into owner;
  else
    raise exception 'unknown_kind';
  end if;
  perform public.mod_log('delete_' || kind, owner, report, note);
end;
$$;

create function public.mod_warn(who uuid, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  perform public.mod_log('warn', who, report, note);
end;
$$;

create function public.mod_resolve(report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  perform public.require_moderator();
  update public.reports set status = 'done' where id = report returning target_user into who;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('resolve', who, report, note);
end;
$$;

-- Sperren: days null = dauerhaft. Nichts wird gelöscht; Anmeldung gesperrt, Inhalte ausgeblendet.
create function public.mod_ban(who uuid, days integer, reason text, report uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ends timestamptz := case when days is null then null else now() + make_interval(days => days) end;
  new_event uuid;
begin
  perform public.require_moderator();
  if who = auth.uid() then raise exception 'self'; end if;
  if days is not null and days not between 1 and 365 then raise exception 'bad_days'; end if;
  if char_length(btrim(coalesce(reason, ''))) = 0 then raise exception 'no_reason'; end if;
  insert into public.bans (user_id, reason, until, banned_by) values (who, btrim(reason), ends, auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, until = excluded.until,
    banned_by = excluded.banned_by, created_at = now();
  -- Anmeldung sperren und laufende Anmeldungen beenden (der Zugang endet spätestens mit dem aktuellen Token)
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

create function public.mod_unban(who uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  new_event uuid;
begin
  perform public.require_moderator();
  delete from public.bans where user_id = who;
  if not found then raise exception 'not_banned'; end if;
  update auth.users set banned_until = null where id = who;
  perform public.mod_log('unban', who, null, note);
  insert into public.ban_events (user_id, kind) values (who, 'unban') returning id into new_event;
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
    body := jsonb_build_object('ban_event', new_event),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke execute on function public.mod_reports(text) from public, anon;
revoke execute on function public.mod_content(text, text) from public, anon;
revoke execute on function public.mod_user(uuid) from public, anon;
revoke execute on function public.mod_user_content(uuid) from public, anon;
revoke execute on function public.mod_user_log(uuid) from public, anon;
revoke execute on function public.mod_delete_content(text, text, uuid, text) from public, anon;
revoke execute on function public.mod_warn(uuid, uuid, text) from public, anon;
revoke execute on function public.mod_resolve(uuid, text) from public, anon;
revoke execute on function public.mod_ban(uuid, integer, text, uuid) from public, anon;
revoke execute on function public.mod_unban(uuid, text) from public, anon;
grant execute on function public.mod_reports(text) to authenticated;
grant execute on function public.mod_content(text, text) to authenticated;
grant execute on function public.mod_user(uuid) to authenticated;
grant execute on function public.mod_user_content(uuid) to authenticated;
grant execute on function public.mod_user_log(uuid) to authenticated;
grant execute on function public.mod_delete_content(text, text, uuid, text) to authenticated;
grant execute on function public.mod_warn(uuid, uuid, text) to authenticated;
grant execute on function public.mod_resolve(uuid, text) to authenticated;
grant execute on function public.mod_ban(uuid, integer, text, uuid) to authenticated;
grant execute on function public.mod_unban(uuid, text) to authenticated;

-- Fotos: Moderatoren dürfen gemeldete Fotos sehen und beim Löschen eines Beitrags entfernen
create policy "Moderatoren lesen Beitragsfotos" on storage.objects
  for select to authenticated using (bucket_id = 'post-photos' and public.is_moderator());
create policy "Moderatoren löschen Beitragsfotos" on storage.objects
  for delete to authenticated using (bucket_id = 'post-photos' and public.is_moderator());

-- ---------------------------------------------------------------------------------------------------------
-- Sperre wirkt überall: Inhalte gesperrter Konten sind für andere unsichtbar, von ihnen kommen keine
-- Anfragen und keine Mitteilungen. (Bestehende Funktionen mit zusätzlicher Prüfung.)
create or replace function public.can_see_post(author uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = auth.uid()
      or (not public.is_banned(author)
          and not public.is_blocked_between(author, auth.uid())
          and (vis = 'public' or (vis = 'friends' and public.are_friends(author, auth.uid()))));
$$;

create or replace function public.can_see_spot(owner uuid, recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid()
      or (not public.is_banned(owner)
          and (recipient is null or recipient = auth.uid()) and public.are_friends(owner, auth.uid()));
$$;

create or replace function public.feed(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], caption text, visibility text,
  photo_paths text[], created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where auth.uid() is not null
    and (p.author_id = auth.uid() or (public.are_friends(p.author_id, auth.uid()) and not public.is_banned(p.author_id)))
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

create or replace function public.post_reactions(posts uuid[])
returns table (post_id uuid, like_count integer, liked boolean, comment_count integer)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select count(*)::int from public.post_likes l
            where l.post_id = p.id and not public.is_blocked_between(l.user_id, auth.uid())
              and not public.is_banned(l.user_id)),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         (select count(*)::int from public.post_comments c
            where c.post_id = p.id and not public.is_blocked_between(c.author_id, auth.uid())
              and not public.is_banned(c.author_id))
  from public.posts p
  where p.id = any (posts[1:100]) and public.can_see_post(p.author_id, p.visibility);
$$;

create or replace function public.post_comment_list(post uuid)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], body text, created_at timestamptz,
  can_delete boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = c.author_id), '{}'),
         c.body, c.created_at,
         c.author_id = auth.uid() or p.author_id = auth.uid()
  from public.post_comments c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = post
    and public.can_see_post(p.author_id, p.visibility)
    and not public.is_blocked_between(c.author_id, auth.uid())
    and not public.is_banned(c.author_id)
  order by c.created_at, c.id
  limit 500;
$$;

create or replace function public.send_friend_request(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  select id into other from public.profiles where username = lower(btrim(name));
  if other is null or public.is_blocked_between(me, other) or public.is_banned(other) then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  select * into existing from public.friendships f
    where least(f.requester, f.addressee) = least(me, other)
      and greatest(f.requester, f.addressee) = greatest(me, other);
  if existing.id is null then
    insert into public.friendships (requester, addressee) values (me, other);
    return 'sent';
  elsif existing.status = 'pending' and existing.addressee = me then
    update public.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
    return 'accepted';
  else
    return 'already';
  end if;
end;
$$;

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
