-- Fangpunkt – „Gefällt mir“ und Kommentare auf dem Server (Wunsch Nutzer 2026-11-04; vorher nur auf dem Gerät).
-- Sichtbar für alle, die den Beitrag sehen dürfen (can_see_post); Blockierte sehen sich gegenseitig nicht.
-- Nutzer schreiben nie direkt in die Tabellen – nur über die Funktionen unten.

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user on public.post_likes (user_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index post_comments_post on public.post_comments (post_id, created_at);
create index post_comments_author on public.post_comments (author_id);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

-- Darf das angemeldete Konto diesen Beitrag sehen (über die ID)?
create function public.can_see_post_id(post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p where p.id = post and public.can_see_post(p.author_id, p.visibility)
  );
$$;
revoke execute on function public.can_see_post_id(uuid) from public, anon;
grant execute on function public.can_see_post_id(uuid) to authenticated;

create policy "Likes sichtbarer Beiträge lesen" on public.post_likes
  for select to authenticated
  using (public.can_see_post_id(post_id) and not public.is_blocked_between(user_id, (select auth.uid())));
create policy "Kommentare sichtbarer Beiträge lesen" on public.post_comments
  for select to authenticated
  using (public.can_see_post_id(post_id) and not public.is_blocked_between(author_id, (select auth.uid())));

revoke all on public.post_likes, public.post_comments from anon, authenticated;
grant select on public.post_likes, public.post_comments to authenticated;

-- „Gefällt mir“ setzen oder zurücknehmen; liefert den neuen Stand. Fehler: 'not_found'
create function public.toggle_like(post uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public.can_see_post_id(post) then raise exception 'not_found'; end if;
  delete from public.post_likes where post_id = post and user_id = me;
  if found then return false; end if;
  insert into public.post_likes (post_id, user_id) values (post, me);
  return true;
end;
$$;

-- Kommentar schreiben (höchstens 300 je Konto und Tag). Fehler: 'not_found', 'too_many', 'empty'
create function public.add_comment(post uuid, body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  result uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public.can_see_post_id(post) then raise exception 'not_found'; end if;
  if char_length(btrim(coalesce(body, ''))) = 0 then raise exception 'empty'; end if;
  if (select count(*) from public.post_comments where author_id = me and created_at > now() - interval '1 day') >= 300 then
    raise exception 'too_many';
  end if;
  insert into public.post_comments (post_id, author_id, body) values (post, me, btrim(body))
  returning id into result;
  return result;
end;
$$;

-- Kommentar löschen: der eigene, oder jeder Kommentar unter dem eigenen Beitrag
create function public.delete_comment(comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.post_comments c
    where c.id = comment
      and (c.author_id = auth.uid()
           or exists (select 1 from public.posts p where p.id = c.post_id and p.author_id = auth.uid()));
end;
$$;

-- Zahlen für mehrere Beiträge auf einmal (Feed, eigener Beitrag); Blockierte zählen nicht mit
create function public.post_reactions(posts uuid[])
returns table (post_id uuid, like_count integer, liked boolean, comment_count integer)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select count(*)::int from public.post_likes l
            where l.post_id = p.id and not public.is_blocked_between(l.user_id, auth.uid())),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         (select count(*)::int from public.post_comments c
            where c.post_id = p.id and not public.is_blocked_between(c.author_id, auth.uid()))
  from public.posts p
  where p.id = any (posts[1:100]) and public.can_see_post(p.author_id, p.visibility);
$$;

-- Kommentare eines Beitrags mit Name und Abzeichen, älteste zuerst (fremde Profile sind sonst nicht lesbar)
create function public.post_comment_list(post uuid)
returns table (
  id uuid,
  author_id uuid,
  username text,
  display_name text,
  badges text[],
  body text,
  created_at timestamptz,
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
  order by c.created_at, c.id
  limit 500;
$$;

revoke execute on function public.toggle_like(uuid) from public, anon;
revoke execute on function public.add_comment(uuid, text) from public, anon;
revoke execute on function public.delete_comment(uuid) from public, anon;
revoke execute on function public.post_reactions(uuid[]) from public, anon;
revoke execute on function public.post_comment_list(uuid) from public, anon;
grant execute on function public.toggle_like(uuid) to authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.post_reactions(uuid[]) to authenticated;
grant execute on function public.post_comment_list(uuid) to authenticated;

-- Kommentare lassen sich jetzt auch melden
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'spot', 'user', 'comment'));
grant select on public.post_comments to service_role;

notify pgrst, 'reload schema';
