-- Fangpunkt – „Angler entdecken“: Profilvorschläge im Feed (Wunsch Nutzer 2026-11-13).
-- Entscheidungen Nutzer: grobe Region nur mit Zustimmung (Standard aus), Gewässer-Freigabe mit eigenem Schalter
-- (nur Gewässerkennung und -name, Standard AN), Erfolge wie im Profil (nach deren Sichtbarkeit), ein PR.
--
-- Was auf den Server kommt (alles freiwillig steuerbar, alles nur über Funktionen, RLS ohne Rechte):
--  * suggestion_prefs   – drei Schalter je Konto: „in Vorschlägen auffindbar“ (Standard an), „Gewässer für
--                         Vorschläge nutzen“ (Standard an), grobe Region (Standard aus = keine Zeile/Koordinate).
--                         Die Region ist der Mittelpunkt eines 0,1°-Rasters (ca. 11 × 7 km); die App rundet schon
--                         auf dem Gerät, der Server rundet noch einmal. Nie eine genaue Position.
--  * user_waters        – höchstens 30 Gewässer je Konto: nur Kennung („osm:w123“) und Name aus den Gewässerdaten.
--                         Keine Orte, Zeiten, Fänge, Spots, Sessions, eigene Namen.
--  * suggestion_dismissals – ausgeblendete Vorschläge (zählt mit; je öfter, desto länger Pause und seltener danach).
-- Die Empfehlung rechnet nur der Server (suggest_anglers). Entfernungen, Koordinaten, Gewässer und fremde Listen
-- verlassen ihn nie – die App erfährt nicht, WARUM jemand vorgeschlagen wird, außer bei gemeinsamen Kontakten (Wunsch
-- Nutzer 2026-11-13): sie erhält nur die Zahl gemeinsamer Kontakte und freigegebene Erfolgsstufen.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabellen
create table public.suggestion_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discoverable boolean not null default true,
  waters_on boolean not null default true,
  -- Rastermittelpunkt in Grad; beide gesetzt oder beide leer (leer = keine Region geteilt)
  region_lat numeric(5, 1) check (region_lat between 45 and 57),
  region_lng numeric(5, 1) check (region_lng between 4 and 17),
  updated_at timestamptz not null default now(),
  check ((region_lat is null) = (region_lng is null))
);
alter table public.suggestion_prefs enable row level security;
revoke all on public.suggestion_prefs from anon, authenticated;
create index suggestion_prefs_region on public.suggestion_prefs (region_lat, region_lng)
  where region_lat is not null;
create trigger zz_deny_banned before insert or update on public.suggestion_prefs
  for each row execute function public.deny_banned_writes();

create table public.user_waters (
  user_id uuid not null references auth.users (id) on delete cascade,
  water_id text not null check (water_id ~ '^osm:[wr][0-9]{1,15}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  rank integer not null default 0,
  primary key (user_id, water_id)
);
alter table public.user_waters enable row level security;
revoke all on public.user_waters from anon, authenticated;
create index user_waters_water on public.user_waters (water_id);
create trigger zz_deny_banned before insert or update on public.user_waters
  for each row execute function public.deny_banned_writes();

create table public.suggestion_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  other uuid not null references auth.users (id) on delete cascade,
  n integer not null default 1 check (n >= 1),
  last_at timestamptz not null default now(),
  primary key (user_id, other),
  check (user_id <> other)
);
alter table public.suggestion_dismissals enable row level security;
revoke all on public.suggestion_dismissals from anon, authenticated;
create trigger zz_deny_banned before insert or update on public.suggestion_dismissals
  for each row execute function public.deny_banned_writes();

-- Folgen nach „wem folge ich“ nachschlagen (Vorschläge über gemeinsame Kontakte)
create index if not exists follows_follower_status on public.follows (follower, status);

-- ---------------------------------------------------------------------------------------------------------
-- 2. Einstellungen
create function public.my_suggestion_prefs()
returns table (discoverable boolean, waters_on boolean, region_on boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(sp.discoverable, true), coalesce(sp.waters_on, true), coalesce(sp.region_lat is not null, false)
  from (select 1) x left join public.suggestion_prefs sp on sp.user_id = auth.uid()
  where auth.uid() is not null;
$$;

create function public.set_my_suggestion_prefs(discoverable boolean, waters_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if discoverable is null or waters_on is null then raise exception 'bad_prefs'; end if;
  insert into public.suggestion_prefs as sp (user_id, discoverable, waters_on)
  values (auth.uid(), discoverable, waters_on)
  on conflict (user_id) do update
    set discoverable = excluded.discoverable, waters_on = excluded.waters_on, updated_at = now();
  -- Gewässer aus: die Liste verschwindet sofort vom Server
  if not waters_on then delete from public.user_waters w where w.user_id = auth.uid(); end if;
end;
$$;

-- Grobe Region setzen (schaltet das Kriterium „Region“ ein). Der Server rundet noch einmal auf 0,1°.
create function public.set_my_region(lat numeric, lng numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  la numeric(5, 1);
  lo numeric(5, 1);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if lat is null or lng is null or lat not between 45 and 57 or lng not between 4 and 17 then
    raise exception 'bad_region';
  end if;
  la := round(lat, 1);
  lo := round(lng, 1);
  insert into public.suggestion_prefs as sp (user_id, region_lat, region_lng)
  values (auth.uid(), la, lo)
  on conflict (user_id) do update set region_lat = la, region_lng = lo, updated_at = now();
end;
$$;

create function public.clear_my_region() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.suggestion_prefs sp set region_lat = null, region_lng = null, updated_at = now()
  where sp.user_id = auth.uid();
end;
$$;

-- Eigene Gewässer ersetzen: [{"id":"osm:w123","name":"De Wittsee"}, …], höchstens 30, die wichtigsten zuerst.
-- Nur wenn „Gewässer für Vorschläge nutzen“ an ist (sonst 0 und nichts wird gespeichert).
create function public.set_my_waters(entries jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  total integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) > 30 then raise exception 'bad_waters'; end if;
  if not coalesce((select sp.waters_on from public.suggestion_prefs sp where sp.user_id = me), true) then
    return 0;
  end if;
  if exists (
    select 1 from jsonb_array_elements(entries) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'id', '') !~ '^osm:[wr][0-9]{1,15}$'
       or char_length(btrim(coalesce(e ->> 'name', ''))) not between 1 and 120
  ) then
    raise exception 'bad_waters';
  end if;
  delete from public.user_waters w
  where w.user_id = me and w.water_id not in (select e ->> 'id' from jsonb_array_elements(entries) e);
  insert into public.user_waters as w (user_id, water_id, name, rank)
  select me, e.v ->> 'id', btrim(e.v ->> 'name'), (e.i - 1)::integer
  from jsonb_array_elements(entries) with ordinality as e(v, i)
  on conflict (user_id, water_id) do update set name = excluded.name, rank = excluded.rank;
  select count(*) into total from public.user_waters w where w.user_id = me;
  return total;
end;
$$;

-- Vorschlag ausblenden (X an der Karte). Wiederholtes Ausblenden verlängert die Pause.
create function public.dismiss_suggestion(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if other is null or other = me or not exists (select 1 from public.profiles p where p.id = other) then
    raise exception 'not_found';
  end if;
  insert into public.suggestion_dismissals as d (user_id, other, n, last_at) values (me, other, 1, now())
  on conflict on constraint suggestion_dismissals_pkey do update set n = least(d.n + 1, 10), last_at = now();
  -- höchstens 500 Einträge je Konto (die ältesten fallen weg)
  delete from public.suggestion_dismissals d
  where d.user_id = me and d.other in (
    select x.other from public.suggestion_dismissals x where x.user_id = me order by x.last_at desc offset 500
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Empfehlung
-- Gewichte als Ausgangspunkt: gemeinsame Kontakte 40 %, gemeinsame Gewässer 35 %, Nähe 25 %. Gerechnet wird nur mit
-- den Kriterien, die für die abfragende Person überhaupt Daten haben (z. B. ohne Region: 40/35 auf 100 verteilt),
-- so verliert niemand Punkte, nur weil er etwas nicht freigegeben hat.
--   gemeinsame Kontakte: Personen, denen ich (bestätigt) folge und die der Kandidatin/dem Kandidaten (bestätigt)
--                        folgen; 4 oder mehr = volle Punkte
--   gemeinsame Gewässer: Anzahl gemeinsamer Gewässerkennungen, 3 oder mehr = volle Punkte (beide „Gewässer“ an)
--   Nähe:                Luftlinie zwischen den beiden Rasterpunkten ≤ 100 km (beide Region an); 0,3 bis 1,0 Punkte
-- Dazu: neue Konten (< 30 Tage) +0,05; ein kleiner täglich wechselnder Wert (≤ 0,03) mischt Gleichstände;
-- Ausgeblendete fehlen für 30 Tage × 2^(n–1) (höchstens ein Jahr) und zählen danach nur halb je Ausblenden.
-- Nie: ich selbst, schon Gefolgte/Angefragte, Blockierte in beide Richtungen, Gesperrte, „nicht auffindbar“.
create function public.suggest_anglers(max_rows integer default 20)
returns table (
  user_id uuid, username text, display_name text, badges text[],
  common_friends integer, achievement_keys text[], score numeric
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_lat numeric;
  my_lng numeric;
  waters_on boolean;
  f_av boolean;
  w_av boolean;
  r_av boolean;
  denom numeric;
  cap integer := least(greatest(coalesce(max_rows, 20), 1), 30);
begin
  if me is null then raise exception 'not signed in'; end if;
  select coalesce(sp.waters_on, true), sp.region_lat, sp.region_lng into waters_on, my_lat, my_lng
  from (select 1) x left join public.suggestion_prefs sp on sp.user_id = me;
  f_av := exists (select 1 from public.follows f where f.follower = me and f.status = 'accepted');
  w_av := waters_on and exists (select 1 from public.user_waters w where w.user_id = me);
  r_av := my_lat is not null;
  denom := (case when f_av then 0.40 else 0 end) + (case when w_av then 0.35 else 0 end)
         + (case when r_av then 0.25 else 0 end);
  if denom = 0 then return; end if;

  return query
  with
  common as (
    select f.followee as u, count(distinct f.follower)::integer as n
    from public.follows f
    where f_av and f.status = 'accepted' and f.followee <> me
      and f.follower in (select m.followee from public.follows m where m.follower = me and m.status = 'accepted')
    group by f.followee
  ),
  water as (
    select ow.user_id as u, count(*)::integer as n
    from public.user_waters mw
    join public.user_waters ow on ow.water_id = mw.water_id and ow.user_id <> me
    left join public.suggestion_prefs op on op.user_id = ow.user_id
    where w_av and mw.user_id = me and coalesce(op.waters_on, true)
    group by ow.user_id
  ),
  near as (
    -- grobe Vorauswahl über das Raster, dann die Luftlinie (Haversine, Erdradius 6371 km)
    select q.u, q.km from (
      select op.user_id as u,
             2 * 6371 * asin(least(1, sqrt(
               power(sin(radians((op.region_lat - my_lat)::float8) / 2), 2)
               + cos(radians(my_lat::float8)) * cos(radians(op.region_lat::float8))
                 * power(sin(radians((op.region_lng - my_lng)::float8) / 2), 2)))) as km
      from public.suggestion_prefs op
      where r_av and op.user_id <> me and op.region_lat is not null
        and op.region_lat between my_lat - 1.0 and my_lat + 1.0
        and op.region_lng between my_lng - 1.8 and my_lng + 1.8
    ) q where q.km <= 100
  ),
  cand as (
    select c.u from common c union select w.u from water w union select n.u from near n
  )
  select pr.id, pr.username, pr.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = pr.id), '{}'),
         coalesce(c.n, 0),
         case when ach.achievements_visibility = 'public'
              then (select array_agg(a.key order by a.unlocked_at) from public.user_achievements a where a.user_id = pr.id)
         end,
         round(((
           ((case when f_av then 0.40 * least(coalesce(c.n, 0), 4) / 4.0 else 0 end)
          + (case when w_av then 0.35 * least(coalesce(w.n, 0), 3) / 3.0 else 0 end)
          + (case when r_av and n.u is not null then 0.25 * (0.3 + 0.7 * (1 - n.km / 100.0)) else 0 end)) / denom
          + (case when pr.created_at > now() - interval '30 days' then 0.05 else 0 end)
          + (abs(hashtext(me::text || pr.id::text || current_date::text)) % 100) / 100.0 * 0.03
         ) * (case when d.n is null then 1.0 else power(0.5, d.n) end))::numeric, 4)
  from cand
  join public.profiles pr on pr.id = cand.u
  join public.profiles ach on ach.id = pr.id
  left join public.suggestion_prefs sp on sp.user_id = pr.id
  left join common c on c.u = pr.id
  left join water w on w.u = pr.id
  left join near n on n.u = pr.id
  left join public.suggestion_dismissals d on d.user_id = me and d.other = pr.id
  where pr.id <> me
    and coalesce(sp.discoverable, true)
    and not exists (select 1 from public.follows f where f.follower = me and f.followee = pr.id)
    and not public.is_blocked_between(pr.id, me)
    and not public.is_banned(pr.id)
    and (d.n is null or d.last_at + interval '30 days' * least(power(2, d.n - 1), 12) <= now())
  order by 7 desc, pr.username
  limit cap;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Rechte: nur angemeldete Konten
revoke execute on function public.my_suggestion_prefs() from public, anon;
revoke execute on function public.set_my_suggestion_prefs(boolean, boolean) from public, anon;
revoke execute on function public.set_my_region(numeric, numeric) from public, anon;
revoke execute on function public.clear_my_region() from public, anon;
revoke execute on function public.set_my_waters(jsonb) from public, anon;
revoke execute on function public.dismiss_suggestion(uuid) from public, anon;
revoke execute on function public.suggest_anglers(integer) from public, anon;
grant execute on function public.my_suggestion_prefs() to authenticated;
grant execute on function public.set_my_suggestion_prefs(boolean, boolean) to authenticated;
grant execute on function public.set_my_region(numeric, numeric) to authenticated;
grant execute on function public.clear_my_region() to authenticated;
grant execute on function public.set_my_waters(jsonb) to authenticated;
grant execute on function public.dismiss_suggestion(uuid) to authenticated;
grant execute on function public.suggest_anglers(integer) to authenticated;

notify pgrst, 'reload schema';
