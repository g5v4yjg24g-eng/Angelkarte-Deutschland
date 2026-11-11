-- Fangpunkt – Rückblick gemeinsamer Sessions (Wunsch Nutzer 2026-11-11, Entscheidung „nur Kennzahlen teilen“).
-- Jede teilnehmende Person lädt nach dem Ende nur Zahlen hoch: Fänge, Bisse, größter Fisch (Art + cm), Zeit am
-- Wasser, Strecke. Keine Route, keine Orte, keine Fotos, keine einzelnen Einträge. Sehen dürfen es nur Teilnehmer
-- der Session (Zusage oder gegangen), ohne Blockierte. Nur erweiternd: es wird nichts gelöscht.

create table public.group_session_stats (
  session_id uuid not null references public.group_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  caught integer not null check (caught between 0 and 1000),
  bites integer not null check (bites between 0 and 2000),
  entries integer not null check (entries between 0 and 2000),
  longest_cm numeric(5, 1) check (longest_cm is null or longest_cm between 0 and 400),
  longest_species text check (longest_species is null or longest_species ~ '^[a-z0-9_-]{1,40}$'),
  active_ms bigint not null check (active_ms between 0 and 604800000),
  distance_m integer check (distance_m is null or distance_m between 0 and 500000),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.group_session_stats enable row level security;
revoke all on public.group_session_stats from anon, authenticated;
create trigger zz_deny_banned before insert or update on public.group_session_stats
  for each row execute function public.deny_banned_writes();

-- Eigene Zahlen hochladen (erneut = Stand ersetzen). Nur wer dabei ist oder war. Fehler: 'not_member', 'bad_stats'
create function public.set_my_group_stats(session uuid, stats jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(stats) <> 'object' then raise exception 'bad_stats'; end if;
  if not exists (select 1 from public.group_session_members m
                 where m.session_id = session and m.user_id = me and m.status in ('joined', 'left')) then
    raise exception 'not_member';
  end if;
  insert into public.group_session_stats as s
    (session_id, user_id, caught, bites, entries, longest_cm, longest_species, active_ms, distance_m, updated_at)
  values (session, me,
    (stats ->> 'caught')::integer, (stats ->> 'bites')::integer, (stats ->> 'entries')::integer,
    (stats ->> 'longest_cm')::numeric, nullif(stats ->> 'longest_species', ''),
    (stats ->> 'active_ms')::bigint, (stats ->> 'distance_m')::integer, now())
  on conflict (session_id, user_id) do update set
    caught = excluded.caught, bites = excluded.bites, entries = excluded.entries,
    longest_cm = excluded.longest_cm, longest_species = excluded.longest_species,
    active_ms = excluded.active_ms, distance_m = excluded.distance_m, updated_at = now();
exception when check_violation or invalid_text_representation or numeric_value_out_of_range or not_null_violation then
  raise exception 'bad_stats';
end;
$$;

-- Zahlen aller Teilnehmer, die welche hochgeladen haben – nur für Teilnehmer, ohne Blockierte
create function public.group_session_stats_list(session uuid)
returns table (
  user_id uuid, caught integer, bites integer, entries integer,
  longest_cm numeric, longest_species text, active_ms bigint, distance_m integer
)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.caught, s.bites, s.entries, s.longest_cm, s.longest_species, s.active_ms, s.distance_m
  from public.group_session_stats s
  where s.session_id = session
    and exists (select 1 from public.group_session_members me
                where me.session_id = session and me.user_id = auth.uid() and me.status in ('joined', 'left'))
    and exists (select 1 from public.group_session_members m
                where m.session_id = session and m.user_id = s.user_id and m.status in ('joined', 'left'))
    and (s.user_id = auth.uid() or (not public.is_blocked_between(s.user_id, auth.uid()) and not public.is_banned(s.user_id)));
$$;

revoke execute on function public.set_my_group_stats(uuid, jsonb) from public, anon;
revoke execute on function public.group_session_stats_list(uuid) from public, anon;
grant execute on function public.set_my_group_stats(uuid, jsonb) to authenticated;
grant execute on function public.group_session_stats_list(uuid) to authenticated;

notify pgrst, 'reload schema';
