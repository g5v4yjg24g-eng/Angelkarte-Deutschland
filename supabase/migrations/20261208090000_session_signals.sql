-- Fangpunkt – Pause, Weiter und Ende in gemeinsamen Sessions (Wunsch Nutzer 2026-11-21).
-- Macht eine Person Pause, geht weiter oder beendet ihre Session, bekommen die anderen Teilnehmer eine Mitteilung
-- („Auch pausieren?“). Auf dem Sperrbildschirm lassen sich „Annehmen“ und „Ablehnen“ direkt antippen; in der App
-- bestätigt man. Erst mit der Zustimmung ändert sich die eigene Session – die Sitzungen bleiben sonst unabhängig.
-- Gespeichert werden nur Art, Auslöser, Session-ID, Zeitpunkt und die Antworten; keine Fänge, Orte oder Positionen.
-- Nur erweiternd: bestehende Funktionen bleiben, enqueue_push/record_notification kennen drei neue Arten.

create table public.session_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.group_sessions (id) on delete cascade,
  kind text not null check (kind in ('pause', 'resume', 'end')),
  by_user uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index session_signals_session on public.session_signals (session_id, at desc);
create index session_signals_user on public.session_signals (by_user, at desc);
alter table public.session_signals enable row level security;
revoke all on public.session_signals from anon, authenticated;

create table public.session_signal_answers (
  signal_id uuid not null references public.session_signals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  accepted boolean not null,
  answered_at timestamptz not null default now(),
  primary key (signal_id, user_id)
);
alter table public.session_signal_answers enable row level security;
revoke all on public.session_signal_answers from anon, authenticated;

-- Mitteilungsarten
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test', 'new_follower',
                  'trip_invite', 'trip_start', 'spot_link', 'spot_link_accepted',
                  'session_pause', 'session_resume', 'session_end'));
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
                  'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start',
                  'spot_link', 'spot_link_accepted', 'session_pause', 'session_resume', 'session_end'));

create or replace function public.record_notification(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if what not in ('friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
                  'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start',
                  'spot_link', 'spot_link_accepted', 'session_pause', 'session_resume', 'session_end') then
    return;
  end if;
  if what = 'like' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'like' and n.actor = who and n.ref is not distinct from target
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'comment_reply' and n.ref is not distinct from target
      and n.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'trip_invite' and n.actor = who and n.ref is not distinct from target
  ) then return; end if;
  if what in ('spot_link', 'spot_link_accepted') and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = what and n.actor = who and n.ref is not distinct from target
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind in ('friend_request', 'new_follower') and n.actor = who
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.notifications (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140));
  delete from public.notifications n
  where n.user_id = recipient
    and (n.created_at < now() - interval '90 days'
         or n.id in (select o.id from public.notifications o where o.user_id = recipient
                     order by o.created_at desc offset 200));
end;
$$;

-- enqueue_push wie in spot_links.sql; neu: Pause/Weiter/Ende zählen zur Art „Sessions“
create or replace function public.enqueue_push(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prefs public.push_prefs;
  new_id uuid;
begin
  if recipient is null or who is null or recipient = who then return; end if;
  if public.is_banned(who) then return; end if;
  if public.is_blocked_between(recipient, who) then return; end if;
  perform public.record_notification(recipient, what, who, target, snippet);
  if not exists (select 1 from public.push_devices d where d.user_id = recipient) then return; end if;
  select * into prefs from public.push_prefs p where p.user_id = recipient;
  if prefs.user_id is not null then
    if what in ('friend_request', 'friend_accepted', 'new_follower') and not prefs.friends then return; end if;
    if what = 'like' and not prefs.likes then return; end if;
    if what in ('comment', 'comment_reply') and not prefs.comments then return; end if;
    if what in ('spot', 'spot_link', 'spot_link_accepted') and not prefs.spots then return; end if;
    if what in ('session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start',
                'session_pause', 'session_resume', 'session_end')
       and not prefs.sessions then return; end if;
    if what = 'new_post' and not prefs.posts then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'comment_reply' and o.ref = target
      and o.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'trip_invite' and o.actor = who and o.ref = target
  ) then return; end if;
  if what in ('spot_link', 'spot_link_accepted') and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = what and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind in ('friend_request', 'new_follower') and o.actor = who
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
revoke execute on function public.record_notification(uuid, text, uuid, text, text) from public, anon, authenticated;

-- Pause, Weiter oder Ende melden: nur wer in der Session „dabei“ ist; Pause/Weiter nur solange die gemeinsame Session
-- läuft. Höchstens 30 Meldungen je Stunde. Die anderen Teilnehmer („dabei“, nicht blockiert, nicht gesperrt) bekommen
-- die Mitteilung. Fehler: 'not_found', 'ended', 'too_many', 'banned'
create function public.signal_session(session uuid, what text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.group_sessions;
  new_id uuid;
  r record;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  if what not in ('pause', 'resume', 'end') then raise exception 'not_found'; end if;
  select * into g from public.group_sessions x where x.id = session;
  if g.id is null or not exists (
    select 1 from public.group_session_members m where m.session_id = session and m.user_id = me and m.status = 'joined'
  ) then raise exception 'not_found'; end if;
  if what in ('pause', 'resume') and g.ended_at is not null then raise exception 'ended'; end if;
  if (select count(*) from public.session_signals s
      where s.by_user = me and s.at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many';
  end if;
  insert into public.session_signals (session_id, kind, by_user) values (session, what, me) returning id into new_id;
  for r in
    select m.user_id from public.group_session_members m
    where m.session_id = session and m.status = 'joined' and m.user_id <> me
  loop
    perform public.enqueue_push(r.user_id, 'session_' || what, me, new_id::text, g.title);
  end loop;
  return new_id;
end;
$$;

-- Meldungen anderer Teilnehmer, die ich noch nicht beantwortet habe (höchstens 12 Stunden alt, je Person und
-- Session nur die neueste). Ohne Blockierte und Gesperrte.
create function public.my_session_signals()
returns table (
  id uuid, session_id uuid, kind text, by_user_id uuid, by_username text, by_display_name text,
  at timestamptz, session_title text, session_ended boolean
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.session_id, s.kind, s.by_user, pr.username, pr.display_name, s.at, g.title, g.ended_at is not null
  from public.session_signals s
  join public.group_sessions g on g.id = s.session_id
  join public.profiles pr on pr.id = s.by_user
  where s.by_user <> auth.uid()
    and s.at > now() - interval '12 hours'
    and exists (select 1 from public.group_session_members m
                where m.session_id = s.session_id and m.user_id = auth.uid() and m.status = 'joined')
    and not exists (select 1 from public.session_signal_answers a where a.signal_id = s.id and a.user_id = auth.uid())
    and not exists (select 1 from public.session_signals n
                    where n.session_id = s.session_id and n.by_user = s.by_user and n.at > s.at)
    and not public.is_blocked_between(auth.uid(), s.by_user)
    and not public.is_banned(s.by_user)
  order by s.at;
$$;

-- Antwort: angenommen (die eigene Session folgt) oder abgelehnt. Nur für Meldungen anderer in meiner Session.
-- Doppeltes Antworten ändert nichts. Fehler: 'not_found'
create function public.answer_session_signal(signal uuid, accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.session_signals;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into s from public.session_signals x where x.id = signal;
  if s.id is null or s.by_user = me or not exists (
    select 1 from public.group_session_members m where m.session_id = s.session_id and m.user_id = me and m.status = 'joined'
  ) then raise exception 'not_found'; end if;
  insert into public.session_signal_answers (signal_id, user_id, accepted) values (signal, me, accept)
    on conflict (signal_id, user_id) do nothing;
end;
$$;

revoke execute on function public.signal_session(uuid, text) from public, anon;
revoke execute on function public.my_session_signals() from public, anon;
revoke execute on function public.answer_session_signal(uuid, boolean) from public, anon;
grant execute on function public.signal_session(uuid, text) to authenticated;
grant execute on function public.my_session_signals() to authenticated;
grant execute on function public.answer_session_signal(uuid, boolean) to authenticated;
