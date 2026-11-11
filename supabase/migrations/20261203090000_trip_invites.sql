-- Fangpunkt – Termin-Einladung für Eingeladene (Wunsch Nutzer 2026-11-11): Wer zu einem Angeltermin eingeladen wird,
-- sieht ihn in der App, sagt zu oder ab und übernimmt ihn in den eigenen Kalender. Der Ersteller sieht, wer zugesagt hat.
-- Gespeichert werden nur Titel, Gewässername (Text), Tag und Uhrzeit – keine Position, keine Notizen.
-- Nur erweiternd: die ältere Funktion invite_to_trip bleibt für ältere App-Versionen.

create table public.trip_invites (
  trip_id uuid not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  water_name text check (water_name is null or char_length(water_name) <= 80),
  trip_date date not null,
  from_time text check (from_time is null or from_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  to_time text check (to_time is null or to_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tz text not null default 'Europe/Berlin' check (char_length(tz) <= 60),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (trip_id, user_id),
  check (host_id <> user_id)
);
create index trip_invites_user on public.trip_invites (user_id, trip_date);
create index trip_invites_host on public.trip_invites (host_id, trip_id);
alter table public.trip_invites enable row level security;
revoke all on public.trip_invites from anon, authenticated;
create trigger zz_deny_banned before insert or update on public.trip_invites
  for each row execute function public.deny_banned_writes();

-- Einladen (erneut = Angaben aktualisieren, die Antwort bleibt). Nur Freunde, höchstens 9, ohne Blockierte/Gesperrte;
-- höchstens 50 neue Einladungen je Ersteller in 24 Stunden. Liefert die Zahl Eingeladener. Fehler: 'banned', 'too_many'
create function public.invite_to_trip2(
  trip uuid, users uuid[], title text default null, water_name text default null,
  trip_date date default null, from_time text default null, to_time text default null, tz text default 'Europe/Berlin'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  u uuid;
  n integer := 0;
  label text := concat_ws(' · ', nullif(btrim(title), ''), nullif(btrim(water_name), ''));
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  if trip_date is null then raise exception 'bad_date'; end if;
  if (select count(*) from public.trip_invites i where i.host_id = me and i.created_at > now() - interval '24 hours') >= 50 then
    raise exception 'too_many';
  end if;
  foreach u in array coalesce(users[1:9], '{}') loop
    continue when u is null or u = me;
    continue when not public.are_friends(me, u) or public.is_banned(u) or public.is_blocked_between(me, u);
    insert into public.trip_invites as i
      (trip_id, host_id, user_id, title, water_name, trip_date, from_time, to_time, tz)
    values (trip, me, u, left(nullif(btrim(title), ''), 120), left(nullif(btrim(water_name), ''), 80), trip_date,
            nullif(from_time, ''), nullif(to_time, ''), coalesce(nullif(left(tz, 60), ''), 'Europe/Berlin'))
    on conflict (trip_id, user_id) do update set
      title = excluded.title, water_name = excluded.water_name, trip_date = excluded.trip_date,
      from_time = excluded.from_time, to_time = excluded.to_time, tz = excluded.tz
      where i.host_id = me;
    perform public.enqueue_push(u, 'trip_invite', me, trip::text,
      concat_ws(' · ', nullif(label, ''), to_char(trip_date, 'DD.MM.')));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Meine Einladungen: offene und zugesagte, ab gestern (Fenster in der App)
create function public.my_trip_invites()
returns table (
  trip_id uuid, host_id uuid, host_username text, host_display_name text,
  title text, water_name text, trip_date date, from_time text, to_time text, tz text, status text
)
language sql stable security definer set search_path = '' as $$
  select i.trip_id, i.host_id, p.username, p.display_name, i.title, i.water_name, i.trip_date, i.from_time, i.to_time,
         i.tz, i.status
  from public.trip_invites i
  join public.profiles p on p.id = i.host_id
  where i.user_id = auth.uid() and i.status in ('invited', 'accepted') and i.trip_date >= current_date - 1
    and not public.is_banned(i.host_id) and not public.is_blocked_between(i.host_id, auth.uid())
  order by i.trip_date, i.from_time nulls first;
$$;

-- Zu- oder absagen. Fehler: 'not_found' (keine Einladung)
create function public.respond_trip_invite(trip uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.trip_invites set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
    where trip_id = trip and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Der Ersteller sieht, wer zu seinen Terminen zugesagt oder abgesagt hat
create function public.trip_invite_statuses(trips uuid[])
returns table (trip_id uuid, user_id uuid, status text)
language sql stable security definer set search_path = '' as $$
  select i.trip_id, i.user_id, i.status from public.trip_invites i
  where i.host_id = auth.uid() and i.trip_id = any (coalesce(trips[1:200], '{}'));
$$;

-- Termin gelöscht: Einladungen zurückziehen (Eingeladene behalten, was sie schon übernommen haben)
create function public.cancel_trip_invites(trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.trip_invites where trip_id = trip and host_id = auth.uid();
end;
$$;

revoke execute on function public.invite_to_trip2(uuid, uuid[], text, text, date, text, text, text) from public, anon;
revoke execute on function public.my_trip_invites() from public, anon;
revoke execute on function public.respond_trip_invite(uuid, boolean) from public, anon;
revoke execute on function public.trip_invite_statuses(uuid[]) from public, anon;
revoke execute on function public.cancel_trip_invites(uuid) from public, anon;
grant execute on function public.invite_to_trip2(uuid, uuid[], text, text, date, text, text, text) to authenticated;
grant execute on function public.my_trip_invites() to authenticated;
grant execute on function public.respond_trip_invite(uuid, boolean) to authenticated;
grant execute on function public.trip_invite_statuses(uuid[]) to authenticated;
grant execute on function public.cancel_trip_invites(uuid) to authenticated;

notify pgrst, 'reload schema';
