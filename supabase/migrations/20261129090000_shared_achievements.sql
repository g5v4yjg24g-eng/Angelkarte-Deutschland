-- Fangpunkt – Erfolge im Profil anderer (Wunsch Nutzer 2026-11-10, Entscheidung „selbst wählbar“).
-- Erfolge werden weiter auf dem Gerät aus dem Fangbuch berechnet; übertragen werden nur Stufe und Datum der
-- Freischaltung – keine Fänge, Orte, Arten oder Zahlen. Wer sie sieht, stellt jede Person selbst ein:
-- Freunde (Standard), Alle mit Konto oder Niemand. Nur erweiternd: es wird nichts gelöscht.

alter table public.profiles
  add column achievements_visibility text not null default 'friends'
    check (achievements_visibility in ('friends', 'public', 'private'));

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- gleiche Schlüssel wie in der App (domain/achievements.ts): „first“ oder „<Familie>:<Stufe>“
  key text not null check (key ~ '^(first|(catches|species|waters|sessions|pike|zander|big):(bronze|silver|gold))$'),
  unlocked_at timestamptz not null,
  primary key (user_id, key)
);
alter table public.user_achievements enable row level security;
revoke all on public.user_achievements from anon, authenticated;
-- gesperrte Konten schreiben nichts (wie *_mod_users.sql)
create trigger zz_deny_banned before insert or update on public.user_achievements
  for each row execute function public.deny_banned_writes();

-- Eigene Stufen übertragen: nimmt nur dazu (wie in der App: eine erreichte Stufe bleibt), Datum nie in der Zukunft
create function public.set_my_achievements(entries jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  added integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(entries) <> 'object' then raise exception 'bad_entries'; end if;
  if (select count(*) from jsonb_object_keys(entries)) > 22 then raise exception 'bad_entries'; end if;
  insert into public.user_achievements (user_id, key, unlocked_at)
  select auth.uid(), e.key, least((e.value #>> '{}')::timestamptz, now())
  from jsonb_each(entries) e
  where e.key ~ '^(first|(catches|species|waters|sessions|pike|zander|big):(bronze|silver|gold))$'
  on conflict (user_id, key) do nothing;
  get diagnostics added = row_count;
  return added;
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception 'bad_entries';
end;
$$;
revoke execute on function public.set_my_achievements(jsonb) from public, anon;
grant execute on function public.set_my_achievements(jsonb) to authenticated;

create function public.my_achievements_visibility() returns text
language sql stable security definer set search_path = '' as $$
  select p.achievements_visibility from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_achievements_visibility() from public, anon;
grant execute on function public.my_achievements_visibility() to authenticated;

create function public.set_my_achievements_visibility(v text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if v not in ('friends', 'public', 'private') then raise exception 'bad_visibility'; end if;
  update public.profiles p set achievements_visibility = v where p.id = auth.uid();
  if not found then raise exception 'no_profile'; end if;
end;
$$;
revoke execute on function public.set_my_achievements_visibility(text) from public, anon;
grant execute on function public.set_my_achievements_visibility(text) to authenticated;

-- Erfolge einer Person – nur, wenn deren Einstellung es erlaubt; nie zwischen Blockierten, nie von Gesperrten.
-- visible = false heißt: nicht freigegeben (die App zeigt dann nichts statt „keine Erfolge“).
create function public.user_achievements(author uuid)
returns table (visible boolean, key text, unlocked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  vis text;
  ok boolean;
begin
  if auth.uid() is null then return; end if;
  select p.achievements_visibility into vis from public.profiles p where p.id = author;
  if not found then return; end if;
  ok := author = auth.uid()
     or (not public.is_blocked_between(author, auth.uid()) and not public.is_banned(author)
         and (vis = 'public' or (vis = 'friends' and public.are_friends(author, auth.uid()))));
  if not ok then
    return query select false, null::text, null::timestamptz;
    return;
  end if;
  return query
  select true, a.key, a.unlocked_at from public.user_achievements a where a.user_id = author order by a.unlocked_at;
  if not found then return query select true, null::text, null::timestamptz; end if;
end;
$$;
revoke execute on function public.user_achievements(uuid) from public, anon;
grant execute on function public.user_achievements(uuid) to authenticated;

notify pgrst, 'reload schema';
