-- Fangpunkt – Zentrale Bildspeicherung (Freigabe Nutzer 2026-11-10):
-- 1. Fehlerbehebung: Die App hat Beiträge per Upsert gespeichert. Ein Upsert braucht das Änderungsrecht für jede
--    mitgeschickte Spalte (author_id, photo_paths, created_at …) – die gibt es bewusst nicht. Folge: Die Fotos lagen
--    im Speicher, aber keine einzige Beitragszeile kam an (Feed, Entdecken und Profile anderer blieben leer).
--    Neu: Veröffentlichen nur über `publish_post` – prüft Verfasser und Fotos, legt höchstens einmal an (ID vom Gerät
--    = Schlüssel, daher keine Doppelten) und ändert bei erneutem Aufruf nur, was die App ohnehin ändern darf.
-- 2. Neue Sichtbarkeit 'private' („Nur ich“): nur der Verfasser sieht Beitrag und Fotos. can_see_post lässt
--    'private' schon heute nur für den Verfasser durch; der Feed prüft die Sichtbarkeit jetzt ausdrücklich.
-- 3. Mitteilung „neuer Beitrag“ nicht für „Nur ich“ und nicht für nachträglich übertragene alte Beiträge.
-- Nur hinzufügend bzw. erweiternd; nichts wird gelöscht. Bestehende Fotos im Speicher bleiben und werden von der App
-- beim Übertragen wieder verwendet (gleiche Pfade).

alter table public.posts drop constraint posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('private', 'friends', 'public'));

-- Veröffentlichen oder (erneut aufgerufen) Text/Sichtbarkeit/Art/Länge/Fotos des eigenen Beitrags nachziehen.
-- Liefert 'created' oder 'updated'. Fehler: not_signed_in, bad_visibility, bad_photos, photo_missing, not_owner,
-- too_many_posts (Trigger, *_discover.sql), not_participant (Trigger, *_group_highlights.sql).
create function public.publish_post(
  post_id uuid, caption text, vis text, paths text[], created timestamptz,
  species text default null, length numeric default null, grp uuid default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  owner uuid;
  path text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if vis is null or vis not in ('private', 'friends', 'public') then raise exception 'bad_visibility'; end if;
  if paths is null or cardinality(paths) not between 1 and 10 then raise exception 'bad_photos'; end if;
  foreach path in array paths loop
    -- nur Fotos im eigenen Ordner dieses Beitrags, und nur, wenn sie wirklich im Speicher liegen
    if path !~ ('^' || me::text || '/' || post_id::text || '/[0-9]{1,2}\.(jpg|png|webp)$') then
      raise exception 'bad_photos';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'post-photos' and o.name = path) then
      raise exception 'photo_missing';
    end if;
  end loop;

  select p.author_id into owner from public.posts p where p.id = post_id for update;
  if owner is not null then
    if owner <> me then raise exception 'not_owner'; end if;
    update public.posts p set
      caption = publish_post.caption, visibility = vis, photo_paths = paths,
      species_id = species, length_cm = length, updated_at = now()
    where p.id = post_id;
    return 'updated';
  end if;

  insert into public.posts (id, author_id, caption, visibility, photo_paths, created_at, species_id, length_cm,
                            group_session_id)
  values (post_id, me, publish_post.caption, vis, paths, least(coalesce(created, now()), now()), species, length,
          grp);
  return 'created';
end;
$$;
revoke execute on function public.publish_post(uuid, text, text, text[], timestamptz, text, numeric, uuid)
  from public, anon;
grant execute on function public.publish_post(uuid, text, text, text[], timestamptz, text, numeric, uuid)
  to authenticated;

-- Feed: Beiträge von Freunden nur mit Sichtbarkeit „Freunde“ oder „Alle“ (nie „Nur ich“); eigene wie bisher
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
                 and public.are_friends(p.author_id, auth.uid())
                 and not public.is_banned(p.author_id))))
      or (p.group_session_id is not null and public.can_see_post(p.author_id, p.visibility, p.group_session_id))
    )
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Mitteilung „neuer Beitrag“: nicht für „Nur ich“ und nicht für alte Beiträge, die erst jetzt übertragen werden
create or replace function public.push_on_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
begin
  if new.visibility = 'private' or new.created_at < now() - interval '1 day' then return new; end if;
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
revoke execute on function public.push_on_post() from public, anon, authenticated;

notify pgrst, 'reload schema';
