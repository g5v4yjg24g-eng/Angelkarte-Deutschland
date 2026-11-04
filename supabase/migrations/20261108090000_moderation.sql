-- Fangpunkt – Melden und Blockieren, Etappe 5 (Pflicht vor dem App Store; Entscheidungen Nutzer 2026-11-03:
-- Benachrichtigung per E-Mail an moderation@fangpunkt.com, Regeln vor dem Versand des Anmeldecodes).
-- Nutzer schreiben nie direkt in die Tabellen – nur über die Funktionen unten.

-- ---------------------------------------------------------------------------------------------------------
-- Blockieren: beendet die Freundschaft, sperrt neue Anfragen in beide Richtungen und blendet Beiträge aus.
create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked on public.blocks (blocked);

alter table public.blocks enable row level security;
create policy "Eigene Blockierungen lesen" on public.blocks
  for select to authenticated using ((select auth.uid()) = blocker);
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;

-- Hat einer der beiden den anderen blockiert?
create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Blockieren: Freundschaft und offene Anfragen zwischen beiden fallen weg; damit enden auch geteilte Spots
-- und Beiträge im Feed (beide setzen eine Freundschaft voraus).
create function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if other is null or other = me then raise exception 'self'; end if;
  insert into public.blocks (blocker, blocked) values (me, other) on conflict do nothing;
  delete from public.friendships f
    where least(f.requester, f.addressee) = least(me, other)
      and greatest(f.requester, f.addressee) = greatest(me, other);
end;
$$;

create function public.unblock_user(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.blocks where blocker = auth.uid() and blocked = other;
end;
$$;

-- Von mir blockierte Konten mit Namen (fremde Profile sind sonst nicht lesbar)
create function public.my_blocks()
returns table (user_id uuid, username text, display_name text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked, p.username, p.display_name, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked
  where b.blocker = auth.uid()
  order by p.display_name;
$$;

revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.my_blocks() from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;

-- Anfragen: Wer blockiert ist (in eine der Richtungen), wird wie ein unbekannter Name behandelt.
create or replace function public.send_friend_request(name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  select id into other from public.profiles where username = lower(btrim(name));
  if other is null or public.is_blocked_between(me, other) then raise exception 'not_found'; end if;
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

-- Beiträge: Blockierte sehen sich gegenseitig auch bei „Alle“ nicht.
create or replace function public.can_see_post(author uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = auth.uid()
      or (not public.is_blocked_between(author, auth.uid())
          and (vis = 'public' or (vis = 'friends' and public.are_friends(author, auth.uid()))));
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Melden: landet hier und per E-Mail bei moderation@fangpunkt.com (Edge Function notify-report, ausgelöst
-- vom Trigger unten). Nur der Datenbank-Eigentümer liest die Tabelle (SQL-Editor).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'spot', 'user')),
  target_id text not null check (char_length(target_id) between 1 and 100),
  target_user uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('spam', 'abuse', 'nudity', 'violence', 'privacy', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'done')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_open on public.reports (status, created_at);

alter table public.reports enable row level security;
-- keine Richtlinie für Nutzer: lesen und ändern nur der Eigentümer (SQL-Editor) bzw. die Edge Function
revoke all on public.reports from anon, authenticated;
-- die Edge Function notify-report (Dienstrolle) liest Meldung und Inhalt und vermerkt den Versand
grant select, update (notified_at) on public.reports to service_role;
grant select on public.reports, public.posts, public.shared_spots, public.profiles to service_role;

-- Meldung abgeben; höchstens 30 je Konto und Tag (gegen Missbrauch der Benachrichtigung)
create function public.report_content(kind text, target text, target_owner uuid, why text, note text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  result uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.reports where reporter = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many';
  end if;
  insert into public.reports (reporter, target_type, target_id, target_user, reason, details)
    values (me, kind, target, target_owner, why, nullif(btrim(note), ''))
  returning id into result;
  return result;
end;
$$;
revoke execute on function public.report_content(text, text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, text, uuid, text, text) to authenticated;

-- Benachrichtigung: nach jeder neuen Meldung die Edge Function anstoßen (nur mit der ID, ohne Schlüssel –
-- die Funktion liest die Meldung selbst). pg_net arbeitet im Hintergrund; schlägt der Aufruf fehl, bleibt
-- notified_at leer und die Meldung ist trotzdem gespeichert.
create extension if not exists pg_net with schema extensions;

create function public.notify_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/notify-report',
    body := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;
revoke execute on function public.notify_report() from public, anon, authenticated;

create trigger reports_notify after insert on public.reports
  for each row execute function public.notify_report();

notify pgrst, 'reload schema';
