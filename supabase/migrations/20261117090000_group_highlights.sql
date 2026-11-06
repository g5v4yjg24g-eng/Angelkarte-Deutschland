-- Fangpunkt – Gemeinsame Sessions, Schritt 8b (Entscheidungen Nutzer 2026-11-06): Highlights sind Beiträge mit
-- Bezug zur gemeinsamen Session. Sie sehen nur der Verfasser und die Teilnehmer (zugesagt, auch wenn später
-- gegangen) – auch im normalen Feed, nie unter Entdecken. Ohne Blockierte und Gesperrte. Nur hinzufügend; bestehende
-- Funktionen werden um die neue Regel ergänzt (gleiche Rückgabe), feed bekommt zwei Spalten dazu.

alter table public.posts
  add column group_session_id uuid references public.group_sessions (id) on delete set null;
create index posts_group on public.posts (group_session_id, created_at desc) where group_session_id is not null;
grant update (group_session_id) on public.posts to authenticated;

-- Teilnehmer = hat zugesagt (auch wenn später gegangen)
create function public.is_group_participant(session uuid, who uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_session_members m
    where m.session_id = session and m.user_id = who and m.status in ('joined', 'left')
  );
$$;
revoke execute on function public.is_group_participant(uuid, uuid) from public, anon, authenticated;

-- Highlight anlegen/ändern nur als Teilnehmer. Sichtbarkeit bleibt „Freunde“ – fällt die gemeinsame Session weg
-- (Konto des Gastgebers gelöscht), wird ein Highlight so höchstens für Freunde sichtbar, nie für alle.
create function public.posts_group_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.group_session_id is not null then
    if (tg_op = 'INSERT' or new.group_session_id is distinct from old.group_session_id)
       and not public.is_group_participant(new.group_session_id, new.author_id) then
      raise exception 'not_participant';
    end if;
    new.visibility := 'friends';
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_group_guard() from public, anon, authenticated;
create trigger posts_group_guard before insert or update on public.posts
  for each row execute function public.posts_group_guard();

-- Sichtbarkeit mit Session-Bezug: Highlights nur für Verfasser und Teilnehmer, sonst wie bisher
create function public.can_see_post(author uuid, vis text, grp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when grp is null then public.can_see_post(author, vis)
    else author = auth.uid()
      or (public.is_group_participant(grp, auth.uid())
          and not public.is_banned(author)
          and not public.is_blocked_between(author, auth.uid()))
  end;
$$;
revoke execute on function public.can_see_post(uuid, text, uuid) from public, anon;
grant execute on function public.can_see_post(uuid, text, uuid) to authenticated;

drop policy "Beiträge lesen" on public.posts;
create policy "Beiträge lesen" on public.posts
  for select to authenticated using (public.can_see_post(author_id, visibility, group_session_id));

drop policy "Sichtbare Beitragsfotos lesen" on storage.objects;
create policy "Sichtbare Beitragsfotos lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.posts p
        where p.author_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
      )
    )
  );

create or replace function public.can_see_post_id(post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = post and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
  );
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
  where p.id = any (posts[1:100]) and public.can_see_post(p.author_id, p.visibility, p.group_session_id);
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
    and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
    and not public.is_blocked_between(c.author_id, auth.uid())
    and not public.is_banned(c.author_id)
  order by c.created_at, c.id
  limit 500;
$$;

create or replace function public.saved_posts(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], caption text, visibility text,
  photo_paths text[], created_at timestamptz, species_id text, length_cm numeric, saved_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at, p.species_id, p.length_cm, s.created_at
  from public.post_saves s
  join public.posts p on p.id = s.post_id
  join public.profiles pr on pr.id = p.author_id
  where s.user_id = auth.uid()
    and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
    and (p.author_id = auth.uid() or not public.is_banned(p.author_id))
    and (before is null or s.created_at < before)
  order by s.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Entdecken: nie Highlights
create or replace function public.discover_feed(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], caption text, visibility text,
  photo_paths text[], created_at timestamptz, species_id text, length_cm numeric, shared_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at, p.species_id, p.length_cm, p.shared_at
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where auth.uid() is not null
    and p.visibility = 'public'
    and p.group_session_id is null
    and p.author_id <> auth.uid()
    and not public.is_banned(p.author_id)
    and not public.is_blocked_between(p.author_id, auth.uid())
    and (before is null or p.shared_at < before)
  order by p.shared_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Feed: wie bisher, dazu Highlights gemeinsamer Sessions, an denen man teilgenommen hat (mit Titel)
drop function public.feed(timestamptz, integer);
create function public.feed(before timestamptz default null, max_rows integer default 20)
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
        and (p.author_id = auth.uid() or (public.are_friends(p.author_id, auth.uid()) and not public.is_banned(p.author_id))))
      or (p.group_session_id is not null and public.can_see_post(p.author_id, p.visibility, p.group_session_id))
    )
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.feed(timestamptz, integer) from public, anon;
grant execute on function public.feed(timestamptz, integer) to authenticated;

-- Highlights einer gemeinsamen Session (für die Zusammenfassung), neueste zuerst
create function public.group_highlights(session uuid, before timestamptz default null, max_rows integer default 20)
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
  join public.group_sessions g on g.id = p.group_session_id
  where p.group_session_id = session
    and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.group_highlights(uuid, timestamptz, integer) from public, anon;
grant execute on function public.group_highlights(uuid, timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
