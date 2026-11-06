-- Fangpunkt – Fischart und Länge am Beitrag (Paket 7a, Freigabe Nutzer 2026-11-06): freiwillig, beim Posten aus
-- einem Fang vorausgefüllt. Kein Fangort. Nur hinzufügend; der Feed liefert die beiden Felder mit.

alter table public.posts
  add column species_id text check (species_id is null or species_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  add column length_cm numeric(4, 1) check (length_cm is null or (length_cm > 0 and length_cm <= 250));

grant update (species_id, length_cm) on public.posts to authenticated;

-- Feed mit Fischart und Länge (Rückgabe ändert sich → neu anlegen; Regeln wie in *_moderators.sql)
drop function public.feed(timestamptz, integer);
create function public.feed(before timestamptz default null, max_rows integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, badges text[], caption text, visibility text,
  photo_paths text[], created_at timestamptz, species_id text, length_cm numeric
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author_id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.author_id), '{}'),
         p.caption, p.visibility, p.photo_paths, p.created_at, p.species_id, p.length_cm
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where auth.uid() is not null
    and (p.author_id = auth.uid() or (public.are_friends(p.author_id, auth.uid()) and not public.is_banned(p.author_id)))
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.feed(timestamptz, integer) from public, anon;
grant execute on function public.feed(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
