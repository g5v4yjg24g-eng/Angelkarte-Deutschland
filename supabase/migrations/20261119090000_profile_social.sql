-- Fangpunkt – Paket 12 (Masterprompt 5.1 „Nutzer suchen“ und 6.1 „Profil erweitern“, Wunsch Nutzer 2026-11-10):
-- 1. Freiwillige Profilangaben auf dem Server (Text, Lieblingsfische, Methoden, Region als Bundesland, bis zu drei
--    angeheftete Beiträge). Sichtbar nur für einen selbst und Freunde – nie für Fremde.
-- 2. Profil einer anderen Person ansehen: Name, Abzeichen, Beziehung; Angaben nur unter Freunden; Beiträge nur,
--    soweit `can_see_post` sie erlaubt (Freunde bzw. „Alle“).
-- 3. Nutzer suchen: Nutzername (Anfang) oder Anzeigename (Teil), ab 3 Zeichen, höchstens 20 Treffer, ohne
--    Blockierte und Gesperrte, höchstens 300 Suchen je Tag (gegen massenhaftes Durchsuchen).
-- Nur hinzufügend: neue Spalten (alle optional), neue Tabelle, neue Funktionen. Nichts wird gelöscht.

-- 1. Spalten (Prüfungen = Regeln der App: domain/profile.ts, domain/schemas.ts)
alter table public.profiles
  add column bio text check (bio is null or char_length(bio) <= 300),
  add column target_species text[] check (
    target_species is null
    or (cardinality(target_species) between 1 and 5
        and array_to_string(target_species, ',') ~ '^[a-z][a-z0-9_]{1,39}(,[a-z][a-z0-9_]{1,39}){0,4}$')
  ),
  add column methods text[] check (
    methods is null
    or (cardinality(methods) between 1 and 5
        and methods <@ array['spinning', 'jigging', 'dropshot', 'bottom', 'float', 'feeder', 'fly', 'trolling', 'other'])
  ),
  add column region text check (
    region is null or region in ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')
  ),
  add column highlight_post_ids uuid[] check (highlight_post_ids is null or cardinality(highlight_post_ids) between 1 and 3);

-- Schreiben nur über die Funktion (die Spalten-Rechte der App bleiben: nur display_name)
create function public.set_my_profile_extras(
  new_bio text, species text[], new_methods text[], new_region text, highlights uuid[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.profiles set
    bio = nullif(btrim(coalesce(new_bio, '')), ''),
    target_species = case when cardinality(species) > 0 then species end,
    methods = case when cardinality(new_methods) > 0 then new_methods end,
    region = nullif(new_region, ''),
    -- nur eigene Beiträge anheften
    highlight_post_ids = (
      select case when count(*) > 0 then array_agg(h order by o) end
      from unnest(highlights) with ordinality as x(h, o)
      where exists (select 1 from public.posts p where p.id = x.h and p.author_id = me)
    )
  where id = me;
  if not found then raise exception 'no_profile'; end if;
end;
$$;
revoke execute on function public.set_my_profile_extras(text, text[], text[], text, uuid[]) from public, anon;
grant execute on function public.set_my_profile_extras(text, text[], text[], text, uuid[]) to authenticated;

-- Moderation: Profiltext und Angaben einer Person entfernen (Meldung „Konto“), mit Protokoll
alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban', 'unban', 'resolve'));

create function public.mod_clear_profile(who uuid, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  update public.profiles
    set bio = null, target_species = null, methods = null, region = null, highlight_post_ids = null
    where id = who;
  perform public.mod_log('clear_profile', who, report, note);
end;
$$;
-- Moderatoren sehen Profiltext und Angaben, um eine Meldung zu beurteilen
create function public.mod_profile_text(who uuid)
returns table (bio text, target_species text[], methods text[], region text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query select p.bio, p.target_species, p.methods, p.region from public.profiles p where p.id = who;
end;
$$;
revoke execute on function public.mod_profile_text(uuid) from public, anon;
grant execute on function public.mod_profile_text(uuid) to authenticated;
revoke execute on function public.mod_clear_profile(uuid, uuid, text) from public, anon;
grant execute on function public.mod_clear_profile(uuid, uuid, text) to authenticated;

-- 2. Profil einer Person (per Nutzername). Leer, wenn es sie nicht gibt, sie blockiert ist oder gesperrt.
-- relation: self | friend | outgoing | incoming | none. Angaben nur bei self/friend.
create function public.user_profile(name text)
returns table (
  user_id uuid, username text, display_name text, badges text[], relation text, friend_count integer,
  bio text, target_species text[], methods text[], region text, highlight_post_ids uuid[]
)
language sql stable security definer set search_path = '' as $$
  with p as (
    select pr.*,
      case
        when pr.id = auth.uid() then 'self'
        else coalesce((
          select case when f.status = 'accepted' then 'friend'
                      when f.requester = auth.uid() then 'outgoing' else 'incoming' end
          from public.friendships f
          where least(f.requester, f.addressee) = least(pr.id, auth.uid())
            and greatest(f.requester, f.addressee) = greatest(pr.id, auth.uid())
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
         (select count(*)::integer from public.friendships f
            where f.status = 'accepted' and p.id in (f.requester, f.addressee)),
         case when p.rel in ('self', 'friend') then p.bio end,
         case when p.rel in ('self', 'friend') then p.target_species end,
         case when p.rel in ('self', 'friend') then p.methods end,
         case when p.rel in ('self', 'friend') then p.region end,
         -- angeheftete Beiträge nur, soweit man sie sehen darf (Reihenfolge bleibt)
         case when p.rel in ('self', 'friend') then (
           select array_agg(x.h order by x.o)
           from unnest(p.highlight_post_ids) with ordinality as x(h, o)
           join public.posts po on po.id = x.h
           where public.can_see_post(po.author_id, po.visibility, po.group_session_id)
         ) end
  from p;
$$;
revoke execute on function public.user_profile(text) from public, anon;
grant execute on function public.user_profile(text) to authenticated;

-- Beiträge einer Person, die man sehen darf (gleiche Spalten wie feed), neueste zuerst; `only_ids` = nur diese
-- (für angeheftete Beiträge)
create function public.user_posts(
  author uuid, before timestamptz default null, max_rows integer default 20, only_ids uuid[] default null
)
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
    and p.author_id = author
    and (only_ids is null or p.id = any(only_ids))
    and public.can_see_post(p.author_id, p.visibility, p.group_session_id)
    and (before is null or p.created_at < before)
  order by p.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;
revoke execute on function public.user_posts(uuid, timestamptz, integer, uuid[]) from public, anon;
grant execute on function public.user_posts(uuid, timestamptz, integer, uuid[]) to authenticated;

-- 3. Nutzer suchen
create table public.user_search_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.user_search_counts enable row level security;
-- keine Richtlinien: nur die Funktion schreibt und liest
revoke all on public.user_search_counts from anon, authenticated;

create function public.search_users(q text)
returns table (user_id uuid, username text, display_name text, badges text[], relation text)
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
  -- % und _ wörtlich nehmen
  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select pr.id, pr.username, pr.display_name,
           coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = pr.id), '{}'),
           coalesce((
             select case when f.status = 'accepted' then 'friend'
                         when f.requester = me then 'outgoing' else 'incoming' end
             from public.friendships f
             where least(f.requester, f.addressee) = least(pr.id, me)
               and greatest(f.requester, f.addressee) = greatest(pr.id, me)
           ), 'none')
    from public.profiles pr
    where pr.id <> me
      and (pr.username like pattern || '%' or lower(pr.display_name) like '%' || pattern || '%')
      and not public.is_blocked_between(pr.id, me)
      and not public.is_banned(pr.id)
    order by (pr.username = term) desc, (pr.username like pattern || '%') desc, pr.username
    limit 20;
end;
$$;
revoke execute on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;

notify pgrst, 'reload schema';
