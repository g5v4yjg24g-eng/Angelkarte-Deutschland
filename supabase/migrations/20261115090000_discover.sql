-- Fangpunkt – Entdecken (Paket 7c, Freigabe Nutzer 2026-11-06): Beiträge mit Sichtbarkeit „Alle“ von allen Konten,
-- neueste zuerst; ohne Blockierte und Gesperrte. Spam-Grenze: höchstens 20 neu geteilte Beiträge je Konto in
-- 24 Stunden. Nur hinzufügend.

-- Wann wurde ein Beitrag geteilt? (created_at stammt vom Gerät und kann alt sein) Bestehende Beiträge: jetzt.
alter table public.posts add column shared_at timestamptz not null default now();
create index posts_public_shared on public.posts (shared_at desc) where visibility = 'public';
create index posts_author_shared on public.posts (author_id, shared_at desc);

-- Neuer Beitrag: Zeitpunkt vom Server, Grenze prüfen. Ein Upsert auf einen vorhandenen Beitrag zählt nicht.
create function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.shared_at := now();
  if exists (select 1 from public.posts where id = new.id) then return new; end if;
  if (select count(*) from public.posts
      where author_id = new.author_id and shared_at > now() - interval '24 hours') >= 20 then
    raise exception 'too_many_posts';
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_before_insert() from public, anon, authenticated;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- Entdecken: öffentliche Beiträge anderer Konten, zuletzt geteilt zuerst
create function public.discover_feed(before timestamptz default null, max_rows integer default 20)
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
    and p.author_id <> auth.uid()
    and not public.is_banned(p.author_id)
    and not public.is_blocked_between(p.author_id, auth.uid())
    and (before is null or p.shared_at < before)
  order by p.shared_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.discover_feed(timestamptz, integer) from public, anon;
grant execute on function public.discover_feed(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
