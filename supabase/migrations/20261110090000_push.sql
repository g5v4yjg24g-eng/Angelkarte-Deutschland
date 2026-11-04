-- Fangpunkt – Push-Mitteilungen in der iPhone-App (Wunsch Nutzer 2026-11-04; Entscheidung: direkt über Apple/APNs,
-- für Freundschaften, „Gefällt mir“, Kommentare und geteilte Spots; jede Art einzeln abschaltbar).
-- Ablauf: Ereignis (Trigger) → Zeile in push_outbox → pg_net ruft die Edge Function send-push mit der ID →
-- die Funktion liest Zeile, Namen und Geräte selbst und schickt an Apple. Nutzer lesen nur ihre eigenen Geräte und
-- Einstellungen und schreiben nur über die Funktionen unten.

-- ---------------------------------------------------------------------------------------------------------
-- Geräte (APNs-Token). Ein Token gehört immer genau einem Konto – meldet sich jemand anders auf dem Gerät an,
-- wandert es mit.
create table public.push_devices (
  token text primary key check (token ~ '^[0-9a-f]{64,200}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null default 'ios' check (platform = 'ios'),
  updated_at timestamptz not null default now()
);
create index push_devices_user on public.push_devices (user_id);
alter table public.push_devices enable row level security;
create policy "Eigene Geräte lesen" on public.push_devices
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_devices from anon, authenticated;
grant select on public.push_devices to authenticated;

create function public.register_push_device(device text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_devices (token, user_id) values (lower(device), auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create function public.unregister_push_device(device text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.push_devices where token = lower(device) and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Einstellungen je Art (fehlt die Zeile, ist alles an)
create table public.push_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  friends boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  spots boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;
create policy "Eigene Einstellungen lesen" on public.push_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_prefs from anon, authenticated;
grant select on public.push_prefs to authenticated;

create function public.set_push_prefs(friends boolean, likes boolean, comments boolean, spots boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_prefs as p (user_id, friends, likes, comments, spots)
    values (auth.uid(), friends, likes, comments, spots)
  on conflict (user_id) do update
    set friends = excluded.friends, likes = excluded.likes, comments = excluded.comments,
        spots = excluded.spots, updated_at = now();
end;
$$;

create function public.my_push_prefs()
returns table (friends boolean, likes boolean, comments boolean, spots boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.friends, true), coalesce(p.likes, true), coalesce(p.comments, true), coalesce(p.spots, true)
  from (select auth.uid() as id) me
  left join public.push_prefs p on p.user_id = me.id
  where me.id is not null;
$$;

revoke execute on function public.register_push_device(text) from public, anon;
revoke execute on function public.unregister_push_device(text) from public, anon;
revoke execute on function public.set_push_prefs(boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.my_push_prefs() from public, anon;
grant execute on function public.register_push_device(text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
grant execute on function public.set_push_prefs(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.my_push_prefs() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Warteschlange (für Nutzer weder lesbar noch schreibbar; die Edge Function vermerkt den Versand)
create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot')),
  actor uuid not null references auth.users (id) on delete cascade,
  ref text,
  excerpt text check (excerpt is null or char_length(excerpt) <= 140),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index push_outbox_recent on public.push_outbox (user_id, kind, actor, ref, created_at);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;
grant select, update (sent_at, error) on public.push_outbox to service_role;
grant select, delete on public.push_devices to service_role;
grant select on public.profiles to service_role;

-- Adresse der Edge Function (beim Anlegen im Dashboard genau „send-push“ als Namen wählen; sonst hier anpassen)
create function public.push_function_url() returns text
language sql immutable set search_path = '' as $$
  select 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/send-push';
$$;

-- Eine Mitteilung einreihen – nur wenn sinnvoll: nicht an sich selbst, nicht zwischen Blockierten, nur wenn die
-- Art eingeschaltet ist und das Konto ein Gerät hat; „Gefällt mir“ höchstens einmal je Person und Beitrag am Tag.
create function public.enqueue_push(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prefs public.push_prefs;
  new_id uuid;
begin
  if recipient is null or who is null or recipient = who then return; end if;
  if public.is_blocked_between(recipient, who) then return; end if;
  if not exists (select 1 from public.push_devices d where d.user_id = recipient) then return; end if;
  select * into prefs from public.push_prefs p where p.user_id = recipient;
  if prefs.user_id is not null then
    if what in ('friend_request', 'friend_accepted') and not prefs.friends then return; end if;
    if what = 'like' and not prefs.likes then return; end if;
    if what = 'comment' and not prefs.comments then return; end if;
    if what = 'spot' and not prefs.spots then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.push_outbox (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140))
  returning id into new_id;
  perform net.http_post(
    url := public.push_function_url(),
    body := jsonb_build_object('id', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;
revoke execute on function public.enqueue_push(uuid, text, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Auslöser
create function public.push_on_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.enqueue_push(new.addressee, 'friend_request', new.requester, null, null);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.enqueue_push(new.requester, 'friend_accepted', new.addressee, null, null);
  end if;
  return new;
end;
$$;
create trigger friendships_push after insert or update on public.friendships
  for each row execute function public.push_on_friendship();

create function public.push_on_like() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_push((select p.author_id from public.posts p where p.id = new.post_id),
                              'like', new.user_id, new.post_id::text, null);
  return new;
end;
$$;
create trigger post_likes_push after insert on public.post_likes
  for each row execute function public.push_on_like();

create function public.push_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_push((select p.author_id from public.posts p where p.id = new.post_id),
                              'comment', new.author_id, new.post_id::text, new.body);
  return new;
end;
$$;
create trigger post_comments_push after insert on public.post_comments
  for each row execute function public.push_on_comment();

-- Geteilter Spot: an den Empfänger, bei „alle Freunde“ an jeden Freund (nur beim ersten Teilen, nicht beim
-- Aktualisieren)
create function public.push_on_spot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  friend uuid;
begin
  if new.recipient_id is not null then
    perform public.enqueue_push(new.recipient_id, 'spot', new.owner_id, new.id::text, new.name);
  else
    for friend in
      select case when f.requester = new.owner_id then f.addressee else f.requester end
      from public.friendships f
      where f.status = 'accepted' and new.owner_id in (f.requester, f.addressee)
    loop
      perform public.enqueue_push(friend, 'spot', new.owner_id, new.id::text, new.name);
    end loop;
  end if;
  return new;
end;
$$;
create trigger shared_spots_push after insert on public.shared_spots
  for each row execute function public.push_on_spot();

revoke execute on function public.push_on_friendship() from public, anon, authenticated;
revoke execute on function public.push_on_like() from public, anon, authenticated;
revoke execute on function public.push_on_comment() from public, anon, authenticated;
revoke execute on function public.push_on_spot() from public, anon, authenticated;

notify pgrst, 'reload schema';
