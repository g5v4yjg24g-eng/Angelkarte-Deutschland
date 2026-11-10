-- Fangpunkt – Admin-Bereich, Phase 1 (Wunsch Nutzer 2026-11-10): Kennzahlen für die Übersicht – nur für Moderatoren,
-- nur echte Zählungen. Liest nur; nichts wird geändert.
--   open_reports  offene Meldungen
--   done_today    heute (Europe/Berlin) erledigte Meldungen (Protokolleintrag „resolve“)
--   banned_now    aktuell gesperrte Konten (befristet und dauerhaft)
--   new_users_7d  neue Profile der letzten 7 Tage
create function public.mod_overview()
returns table (open_reports integer, done_today integer, banned_now integer, new_users_7d integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query select
    (select count(*)::integer from public.reports r where r.status = 'open'),
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
