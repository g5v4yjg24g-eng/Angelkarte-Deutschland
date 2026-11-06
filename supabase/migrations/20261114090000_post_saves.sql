-- Fangpunkt – Beiträge speichern (Paket 7b, Freigabe Nutzer 2026-11-06): Lesezeichen nur für einen selbst; der
-- Verfasser erfährt nichts. Nicht mehr sichtbare Beiträge (gelöscht, nicht mehr geteilt, blockiert, gesperrt)
-- fallen aus der Liste. Nur hinzufügend; Schreiben nur über toggle_save.

create table public.post_saves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_saves_user_created on public.post_saves (user_id, created_at desc);

alter table public.post_saves enable row level security;
create policy "Eigene Lesezeichen lesen" on public.post_saves
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.post_saves from anon, authenticated;
grant select on public.post_saves to authenticated;

-- Speichern umschalten; liefert den neuen Stand. Fehler: 'not_found' (Beitrag nicht sichtbar), 'too_many'
create function public.toggle_save(post uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.post_saves where user_id = me and post_id = post;
  if found then return false; end if;
  if not public.can_see_post_id(post) then raise exception 'not_found'; end if;
  if (select count(*) from public.post_saves where user_id = me) >= 2000 then raise exception 'too_many'; end if;
  insert into public.post_saves (user_id, post_id) values (me, post);
  return true;
end;
$$;

-- Welche dieser Beiträge habe ich gespeichert? (höchstens 100 auf einmal)
create function public.my_saved_ids(posts uuid[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.post_id from public.post_saves s
  where s.user_id = auth.uid() and s.post_id = any (posts[1:100]);
$$;

-- Gespeicherte Beiträge wie im Feed, zuletzt gespeichert zuerst; nur noch sichtbare
create function public.saved_posts(before timestamptz default null, max_rows integer default 20)
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
    and public.can_see_post(p.author_id, p.visibility)
    and (p.author_id = auth.uid() or not public.is_banned(p.author_id))
    and (before is null or s.created_at < before)
  order by s.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

revoke execute on function public.toggle_save(uuid) from public, anon;
revoke execute on function public.my_saved_ids(uuid[]) from public, anon;
revoke execute on function public.saved_posts(timestamptz, integer) from public, anon;
grant execute on function public.toggle_save(uuid) to authenticated;
grant execute on function public.my_saved_ids(uuid[]) to authenticated;
grant execute on function public.saved_posts(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
