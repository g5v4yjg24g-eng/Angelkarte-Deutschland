-- Fangpunkt – Spots teilen, Etappe 4 (Wunsch Nutzer 2026-11-03; Entscheidung: genaue Position).
-- Ein gespeicherter Ort wird mit einem Freund oder mit allen Freunden geteilt. Sichtbar nur, solange die
-- Freundschaft besteht. Nutzer schreiben nie direkt in die Tabelle – nur über die Funktionen unten.

create table public.shared_spots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- ID des Orts auf dem Gerät des Teilenden (für „Nicht mehr teilen“ und erneutes Teilen)
  place_id text not null check (char_length(place_id) between 1 and 100),
  -- null = alle Freunde
  recipient_id uuid references auth.users (id) on delete cascade,
  place_type text not null check (place_type in ('spot', 'jetty', 'parking', 'access', 'hazard', 'other')),
  name text check (name is null or char_length(name) <= 80),
  note text check (note is null or char_length(note) <= 2000),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_id is null or recipient_id <> owner_id)
);

-- je Ort höchstens einmal pro Empfänger bzw. einmal für „alle Freunde“
create unique index shared_spots_once on public.shared_spots
  (owner_id, place_id, coalesce(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index shared_spots_recipient on public.shared_spots (recipient_id);

alter table public.shared_spots enable row level security;

-- Darf das angemeldete Konto diesen Spot sehen? Eigene immer; fremde nur von Freunden.
create function public.can_see_spot(owner uuid, recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid()
      or ((recipient is null or recipient = auth.uid()) and public.are_friends(owner, auth.uid()));
$$;
revoke execute on function public.can_see_spot(uuid, uuid) from public, anon;
grant execute on function public.can_see_spot(uuid, uuid) to authenticated;

create policy "Geteilte Spots lesen" on public.shared_spots
  for select to authenticated using (public.can_see_spot(owner_id, recipient_id));

revoke all on public.shared_spots from anon, authenticated;
grant select on public.shared_spots to authenticated;

-- Teilen (oder denselben Ort erneut teilen = Inhalt aktualisieren). recipient null = alle Freunde.
-- Fehler: 'not_friends', 'no_profile'
create function public.share_spot(
  place text,
  recipient uuid,
  kind text,
  spot_name text,
  spot_note text,
  spot_lat double precision,
  spot_lng double precision
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  result uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  if recipient is not null and not public.are_friends(me, recipient) then raise exception 'not_friends'; end if;
  insert into public.shared_spots as s (owner_id, place_id, recipient_id, place_type, name, note, lat, lng)
    values (me, place, recipient, kind, nullif(btrim(spot_name), ''), nullif(btrim(spot_note), ''), spot_lat, spot_lng)
  on conflict (owner_id, place_id, coalesce(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set place_type = excluded.place_type, name = excluded.name, note = excluded.note,
                lat = excluded.lat, lng = excluded.lng, updated_at = now()
  returning s.id into result;
  return result;
end;
$$;

-- Teilen beenden (nur der Teilende)
create function public.unshare_spot(spot uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.shared_spots where id = spot and owner_id = auth.uid();
end;
$$;

-- Eigene geteilte Spots (outgoing, mit Empfängername) und die von Freunden (incoming, mit Name/Abzeichen).
-- Fremde Profile sind sonst nicht lesbar.
create function public.my_shared_spots()
returns table (
  id uuid,
  place_id text,
  direction text,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_badges text[],
  recipient_id uuid,
  recipient_username text,
  recipient_display_name text,
  place_type text,
  name text,
  note text,
  lat double precision,
  lng double precision,
  updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.id,
         s.place_id,
         case when s.owner_id = auth.uid() then 'outgoing' else 'incoming' end,
         s.owner_id,
         o.username,
         o.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = s.owner_id), '{}'),
         s.recipient_id,
         r.username,
         r.display_name,
         s.place_type,
         s.name,
         s.note,
         s.lat,
         s.lng,
         s.updated_at
  from public.shared_spots s
  join public.profiles o on o.id = s.owner_id
  left join public.profiles r on r.id = s.recipient_id
  where public.can_see_spot(s.owner_id, s.recipient_id)
  order by s.updated_at desc
  limit 500;
$$;

revoke execute on function public.share_spot(text, uuid, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.unshare_spot(uuid) from public, anon;
revoke execute on function public.my_shared_spots() from public, anon;
grant execute on function public.share_spot(text, uuid, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.unshare_spot(uuid) to authenticated;
grant execute on function public.my_shared_spots() to authenticated;

notify pgrst, 'reload schema';
