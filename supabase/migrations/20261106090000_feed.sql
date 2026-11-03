-- Fangpunkt – Feed, Etappe 3 (Wunsch Nutzer 2026-11-03): Beiträge von Freunden und eigene, neueste zuerst.
-- Fremde Profile sind sonst nicht lesbar – die Funktion liefert nur Name und Abzeichen der Verfasser.

create function public.feed(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid,
  author_id uuid,
  username text,
  display_name text,
  badges text[],
  caption text,
  visibility text,
  photo_paths text[],
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where auth.uid() is not null
    and (p.author_id = auth.uid() or public.are_friends(p.author_id, auth.uid()))
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.feed(timestamptz, integer) from public, anon;
grant execute on function public.feed(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
