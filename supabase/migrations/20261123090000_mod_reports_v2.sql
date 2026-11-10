-- Fangpunkt – Admin-Bereich, Meldungsverwaltung (Wunsch Nutzer 2026-11-10, Vorschau freigegeben).
-- Nur erweiternd: keine Meldung, kein Beitrag und kein Protokolleintrag wird gelöscht.
--  1. Meldungen bekommen den Stand „in Bearbeitung“ und vermerken, wer sie wann bearbeitet/erledigt hat.
--  2. Beiträge lassen sich ausblenden und wiederherstellen: ausgeblendet = für alle außer dem Verfasser unsichtbar
--     (wie „Nur ich“); der Verfasser kann das nicht selbst rückgängig machen.
--  3. Die meldende Person wird nicht mehr mit jeder Liste geliefert, sondern nur auf ausdrückliche Anfrage – und diese
--     Anfrage wird protokolliert.
--  4. Entfernen und Ausblenden nur mit Begründung; höchstens 50 solche Eingriffe je Moderator in 24 Stunden
--     (Schutz vor Massenaktionen, z. B. bei einem kompromittierten Konto).
-- Ältere App-Versionen nutzen weiter mod_reports und mod_resolve; beide bleiben bestehen.

-- 1. Stand der Meldungen ---------------------------------------------------------------------------------
alter table public.reports drop constraint reports_status_check;
alter table public.reports add constraint reports_status_check check (status in ('open', 'in_progress', 'done'));
alter table public.reports
  add column handled_by uuid references auth.users (id) on delete set null,
  add column handled_at timestamptz;

-- Protokoll: weitere Aktionen
alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban',
                    'unban', 'resolve', 'in_progress', 'reopen', 'hide_post', 'restore_post', 'view_reporter'));
-- Protokoll nach Meldung lesen
create index moderation_log_report on public.moderation_log (report_id, created_at) where report_id is not null;

-- Schutz vor Massenaktionen: einschneidende Eingriffe je Moderator in 24 Stunden
create function public.mod_rate_check() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select count(*) from public.moderation_log l
      where l.moderator = auth.uid()
        and l.action in ('delete_post', 'delete_comment', 'delete_spot', 'hide_post', 'ban')
        and l.created_at > now() - interval '24 hours') >= 50 then
    raise exception 'too_many_actions';
  end if;
end;
$$;
revoke execute on function public.mod_rate_check() from public, anon, authenticated;

-- Stand setzen: in Bearbeitung, wieder offen, erledigt (ohne Verstoß bzw. nach einer Maßnahme)
create function public.mod_set_report_status(report uuid, new_status text, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  perform public.require_moderator();
  if new_status not in ('open', 'in_progress', 'done') then raise exception 'bad_status'; end if;
  update public.reports r set
    status = new_status,
    handled_by = case when new_status = 'open' then null else auth.uid() end,
    handled_at = case when new_status = 'done' then now() else null end
  where r.id = report
  returning r.target_user into who;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log(
    case new_status when 'done' then 'resolve' when 'in_progress' then 'in_progress' else 'reopen' end,
    who, report, note);
end;
$$;
revoke execute on function public.mod_set_report_status(uuid, text, text) from public, anon;
grant execute on function public.mod_set_report_status(uuid, text, text) to authenticated;

-- Bisheriges „erledigt“ vermerkt jetzt auch, wer und wann
create or replace function public.mod_resolve(report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.mod_set_report_status(report, 'done', note);
end;
$$;

-- Meldungen für die neue Liste: wie mod_reports, aber ohne die meldende Person (siehe mod_report_reporter),
-- dazu: wie viele Meldungen es zum selben Inhalt gibt, Stand der Bearbeitung, ob der Beitrag ausgeblendet ist
create function public.mod_reports2(state text default 'open')
returns table (
  id uuid, target_type text, target_id text, reason text, details text, status text, created_at timestamptz,
  target_user uuid, target_name text, target_username text, target_banned boolean, open_against integer,
  same_target integer, handled_at timestamptz, handled_by_name text, target_hidden boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
         r.target_user, tp.display_name, tp.username, public.is_banned(r.target_user),
         (select count(*)::int from public.reports x where x.target_user = r.target_user and x.status <> 'done'),
         (select count(*)::int from public.reports x where x.target_type = r.target_type and x.target_id = r.target_id),
         r.handled_at, hp.display_name,
         r.target_type = 'post' and exists (
           select 1 from public.posts p where p.id::text = r.target_id and p.hidden_at is not null)
  from public.reports r
  left join public.profiles tp on tp.id = r.target_user
  left join public.profiles hp on hp.id = r.handled_by
  where state = 'all' or r.status = state
  order by r.created_at desc
  limit 300;
end;
$$;
revoke execute on function public.mod_reports2(text) from public, anon;
grant execute on function public.mod_reports2(text) to authenticated;

-- Meldende Person nur auf Anfrage – jede Anfrage steht im Protokoll
create function public.mod_report_reporter(report uuid)
returns table (reporter uuid, display_name text, username text)
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  perform public.require_moderator();
  select r.target_user into who from public.reports r where r.id = report;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('view_reporter', who, report, null);
  return query select r.reporter, p.display_name, p.username
    from public.reports r left join public.profiles p on p.id = r.reporter where r.id = report;
end;
$$;
revoke execute on function public.mod_report_reporter(uuid) from public, anon;
grant execute on function public.mod_report_reporter(uuid) to authenticated;

-- Verlauf einer Meldung: alle Protokolleinträge dazu, älteste zuerst
create function public.mod_report_log(report uuid)
returns table (action text, detail text, created_at timestamptz, moderator_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select l.action, l.detail, l.created_at, mp.display_name
  from public.moderation_log l left join public.profiles mp on mp.id = l.moderator
  where l.report_id = report
  order by l.created_at, l.id
  limit 200;
end;
$$;
revoke execute on function public.mod_report_log(uuid) from public, anon;
grant execute on function public.mod_report_log(uuid) to authenticated;

-- 2. Beiträge ausblenden / wiederherstellen ---------------------------------------------------------------
alter table public.posts
  add column hidden_at timestamptz,
  add column hidden_by uuid references auth.users (id) on delete set null,
  add column hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 500),
  -- Sichtbarkeit vor dem Ausblenden (kommt beim Wiederherstellen zurück)
  add column hidden_prev_visibility text check (hidden_prev_visibility in ('private', 'friends', 'public'));

-- Ausgeblendet bleibt „Nur ich“, auch wenn der Verfasser die Sichtbarkeit ändert (App, publish_post): Der Wunsch
-- wird gemerkt und gilt erst nach dem Wiederherstellen. Läuft nach posts_group_guard (Reihenfolge nach Namen).
create function public.posts_hidden_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden_at is not null and coalesce(current_setting('fangpunkt.mod_unhide', true), '') <> '1' then
    if new.visibility <> 'private' then new.hidden_prev_visibility := new.visibility; end if;
    new.visibility := 'private';
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_hidden_guard() from public, anon, authenticated;
create trigger posts_hidden_guard before insert or update on public.posts
  for each row execute function public.posts_hidden_guard();

-- Highlights gemeinsamer Sessions: sonst sehen Teilnehmer sie unabhängig von der Sichtbarkeit – ausgeblendet nicht
create or replace function public.can_see_post(author uuid, vis text, grp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when grp is null then public.can_see_post(author, vis)
    else author = auth.uid()
      or (vis <> 'private'
          and public.is_group_participant(grp, auth.uid())
          and not public.is_banned(author)
          and not public.is_blocked_between(author, auth.uid()))
  end;
$$;

create function public.mod_hide_post(post uuid, report uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  perform public.require_moderator();
  if char_length(btrim(coalesce(reason, ''))) = 0 then raise exception 'no_reason'; end if;
  perform public.mod_rate_check();
  update public.posts p set
    hidden_prev_visibility = coalesce(p.hidden_prev_visibility, p.visibility),
    hidden_at = now(), hidden_by = auth.uid(), hidden_reason = btrim(reason), visibility = 'private'
  where p.id = post and p.hidden_at is null
  returning p.author_id into owner;
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('hide_post', owner, report, reason);
end;
$$;
revoke execute on function public.mod_hide_post(uuid, uuid, text) from public, anon;
grant execute on function public.mod_hide_post(uuid, uuid, text) to authenticated;

create function public.mod_restore_post(post uuid, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  perform public.require_moderator();
  perform set_config('fangpunkt.mod_unhide', '1', true);
  update public.posts p set
    visibility = coalesce(p.hidden_prev_visibility, 'friends'),
    hidden_at = null, hidden_by = null, hidden_reason = null, hidden_prev_visibility = null
  where p.id = post and p.hidden_at is not null
  returning p.author_id into owner;
  perform set_config('fangpunkt.mod_unhide', '', true);
  if not found then raise exception 'not_found'; end if;
  perform public.mod_log('restore_post', owner, report, note);
end;
$$;
revoke execute on function public.mod_restore_post(uuid, uuid, text) from public, anon;
grant execute on function public.mod_restore_post(uuid, uuid, text) to authenticated;

-- Stand eines Beitrags für die Meldung (ausgeblendet? warum? seit wann?)
create function public.mod_post_state(post uuid)
returns table (hidden_at timestamptz, hidden_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query select p.hidden_at, p.hidden_reason from public.posts p where p.id = post;
end;
$$;
revoke execute on function public.mod_post_state(uuid) from public, anon;
grant execute on function public.mod_post_state(uuid) to authenticated;

-- 4. Entfernen nur mit Begründung und mit Grenze ----------------------------------------------------------
create or replace function public.mod_delete_content(kind text, target text, report uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  perform public.require_moderator();
  if char_length(btrim(coalesce(note, ''))) = 0 then raise exception 'no_reason'; end if;
  perform public.mod_rate_check();
  if kind = 'post' then
    delete from public.posts where id::text = target returning author_id into owner;
  elsif kind = 'comment' then
    delete from public.post_comments where id::text = target returning author_id into owner;
  elsif kind = 'spot' then
    delete from public.shared_spots where id::text = target returning owner_id into owner;
  else
    raise exception 'unknown_kind';
  end if;
  perform public.mod_log('delete_' || kind, owner, report, note);
end;
$$;

-- Übersicht: jetzt auch „in Bearbeitung“
drop function public.mod_overview();
create function public.mod_overview()
returns table (open_reports integer, in_progress integer, done_today integer, banned_now integer, new_users_7d integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query select
    (select count(*)::integer from public.reports r where r.status = 'open'),
    (select count(*)::integer from public.reports r where r.status = 'in_progress'),
    (select count(*)::integer from public.moderation_log l
       where l.action = 'resolve'
         and l.created_at >= (date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')),
    (select count(*)::integer from public.bans b where b.until is null or b.until > now()),
    (select count(*)::integer from public.profiles p where p.created_at > now() - interval '7 days');
end;
$$;
revoke execute on function public.mod_overview() from public, anon;
grant execute on function public.mod_overview() to authenticated;

notify pgrst, 'reload schema';
