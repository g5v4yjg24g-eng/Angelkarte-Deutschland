-- Fangpunkt – Pop-up und Mitteilung für Moderatoren bei neuen Meldungen (Wunsch Nutzer 2026-11-23).
-- 1) Eine neue Meldung löst eine Mitteilung an alle Moderatoren mit Gerät aus (höchstens eine je 10 Minuten und
--    Moderator, damit eine Welle von Meldungen das Handy nicht lahmlegt). Die Mitteilung nennt nur den Grund, nie
--    die meldende Person, das Ziel oder Details.
-- 2) mod_alert_summary() liefert der App für das Pop-up: Zahl der offenen Meldungen, Alter der ältesten und Angaben
--    zur neuesten (Art und Grund). Nur für Moderatoren; keine meldende Person, keine Inhalte.
-- Nur erweiternd: bestehende Funktionen bleiben.

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test', 'new_follower',
                  'trip_invite', 'trip_start', 'spot_link', 'spot_link_accepted',
                  'session_pause', 'session_resume', 'session_end', 'report_new'));

-- Auslöser: nach dem Anlegen einer Meldung die Moderatoren benachrichtigen. Der Eintrag nennt als „Auslöser“ den
-- Moderator selbst (die Spalte darf nicht leer sein) – die meldende Person erscheint nirgends.
create function public.notify_moderators_of_report()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  new_id uuid;
begin
  for m in
    select mo.user_id from public.moderators mo
    where exists (select 1 from public.push_devices d where d.user_id = mo.user_id)
      and not public.is_banned(mo.user_id)
      and not exists (
        select 1 from public.push_outbox o
        where o.user_id = mo.user_id and o.kind = 'report_new' and o.created_at > now() - interval '10 minutes'
      )
  loop
    insert into public.push_outbox (user_id, kind, actor, ref, excerpt)
      values (m.user_id, 'report_new', m.user_id, new.id::text, new.reason)
    returning id into new_id;
    perform net.http_post(
      url := public.push_function_url(),
      body := jsonb_build_object('id', new_id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;
  return new;
end;
$$;
revoke execute on function public.notify_moderators_of_report() from public, anon, authenticated;

create trigger reports_alert_moderators
  after insert on public.reports
  for each row execute function public.notify_moderators_of_report();

-- Zusammenfassung für das Pop-up (eine Zeile; bei keiner offenen Meldung open_count = 0 und die übrigen Spalten leer)
create function public.mod_alert_summary()
returns table (
  open_count integer, oldest_at timestamptz, newest_id uuid, newest_at timestamptz,
  newest_type text, newest_reason text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select
    (select count(*)::integer from public.reports r where r.status = 'open'),
    (select min(r.created_at) from public.reports r where r.status = 'open'),
    n.id, n.created_at, n.target_type, n.reason
  from (select 1) one
  left join lateral (
    select r.id, r.created_at, r.target_type, r.reason from public.reports r
    where r.status = 'open' order by r.created_at desc limit 1
  ) n on true;
end;
$$;
revoke execute on function public.mod_alert_summary() from public, anon;
grant execute on function public.mod_alert_summary() to authenticated;

notify pgrst, 'reload schema';
