-- Fangpunkt – Freunde, Etappe 1 (Wunsch Nutzer 2026-11-03, Entscheidung: Freundschaftsanfrage wie früher bei
-- Facebook). Anfrage per Nutzername, der andere nimmt an oder lehnt ab. Jede Freundschaft gibt es einmal je Paar.
-- Nutzer schreiben nie direkt in die Tabelle – nur über die Funktionen unten, die jede Regel prüfen.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);

-- ein Eintrag je Paar, egal wer angefragt hat
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;

create policy "Eigene Freundschaften lesen" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

-- Sind zwei Konten befreundet? (für spätere Regeln: Beiträge, geteilte Spots)
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Anfrage per Nutzername. Hat der andere schon angefragt, wird daraus sofort eine Freundschaft.
-- Ergebnis: 'sent' | 'accepted' | 'already' ; Fehler: 'not_found', 'self', 'no_profile'
create function public.send_friend_request(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  select id into other from public.profiles where username = lower(btrim(name));
  if other is null then raise exception 'not_found'; end if;
  if other = me then raise exception 'self'; end if;
  select * into existing from public.friendships f
    where least(f.requester, f.addressee) = least(me, other)
      and greatest(f.requester, f.addressee) = greatest(me, other);
  if existing.id is null then
    insert into public.friendships (requester, addressee) values (me, other);
    return 'sent';
  elsif existing.status = 'pending' and existing.addressee = me then
    update public.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
    return 'accepted';
  else
    return 'already';
  end if;
end;
$$;

-- Anfrage annehmen oder ablehnen (nur der Angefragte)
create function public.respond_friend_request(request uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
      where id = request and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = request and addressee = me and status = 'pending';
  end if;
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Freundschaft beenden oder eigene Anfrage zurückziehen
create function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.friendships f
    where least(f.requester, f.addressee) = least(me, other)
      and greatest(f.requester, f.addressee) = greatest(me, other);
end;
$$;

-- Freunde und offene Anfragen mit Name und Abzeichen. Fremde Profile sind sonst nicht lesbar.
create function public.my_friends()
returns table (
  request_id uuid,
  user_id uuid,
  username text,
  display_name text,
  status text,
  direction text,
  badges text[],
  since timestamptz
)
language sql stable security definer set search_path = '' as $$
  select f.id,
         p.id,
         p.username,
         p.display_name,
         f.status,
         case when f.requester = auth.uid() then 'outgoing' else 'incoming' end,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.id), '{}'),
         coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by p.display_name;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friends() from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;

notify pgrst, 'reload schema';
