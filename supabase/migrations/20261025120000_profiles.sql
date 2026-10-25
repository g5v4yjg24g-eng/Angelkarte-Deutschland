-- Fangpunkt – Konto, Etappe 1 (Entscheidung Nutzer 2026-10-25): freiwilliges Konto mit E-Mail-Code,
-- Profil mit eindeutigem Nutzernamen. Jeder sieht und ändert nur sein eigenes Profil; der Nutzername ist fest.
-- Persönliche Fangdaten liegen NICHT hier – sie bleiben auf dem Gerät.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 3–20 Zeichen, Kleinbuchstaben, Ziffern, _ und ., beginnt mit Buchstabe (gleiche Regel wie domain/account.ts)
  username text not null unique
    check (username ~ '^[a-z][a-z0-9_.]{2,19}$')
    check (username not in ('admin', 'fangpunkt', 'support', 'moderator', 'system')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Eigenes Profil lesen" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Eigenes Profil anlegen" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Eigenes Profil ändern" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Ohne Anmeldung kein Zugriff; angemeldet nur anlegen und den Anzeigenamen ändern (Nutzername bleibt fest)
revoke all on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create function public.profiles_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

-- Ist ein Nutzername frei? (ohne fremde Profile lesen zu müssen)
create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = lower(btrim(name)));
$$;
revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- Konto endgültig löschen: entfernt den Nutzer, das Profil folgt über on delete cascade
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
