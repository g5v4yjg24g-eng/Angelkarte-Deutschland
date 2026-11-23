\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000a2','ali','Ali'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl');
-- A1 und A2 sind Moderatoren; nur A1 hat ein Gerät
insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2');
insert into public.push_devices(user_id, token) values ('00000000-0000-0000-0000-0000000000a1', repeat('a', 64));
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;

-- ohne offene Meldung
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) \g /dev/null
select 'Ohne Meldung', t($q$ select concat_ws(' ', open_count, coalesce(newest_id::text,'-')) from public.mod_alert_summary() $q$);
reset role;

-- B meldet C: nur der Moderator mit Gerät bekommt eine Mitteilung, ohne die meldende Person zu nennen
insert into public.reports(reporter, target_type, target_id, target_user, reason)
  values ('00000000-0000-0000-0000-0000000000b1','user','c','00000000-0000-0000-0000-0000000000c1','abuse');
select 'Mitteilungen', count(*), string_agg(distinct kind || ':' || excerpt, ','), bool_and(actor = user_id) from public.push_outbox where kind = 'report_new';
select 'Empfänger ist Moderator mit Gerät', bool_and(user_id = '00000000-0000-0000-0000-0000000000a1') from public.push_outbox where kind = 'report_new';
-- zweite Meldung innerhalb von 10 Minuten: keine weitere Mitteilung
insert into public.reports(reporter, target_type, target_id, target_user, reason)
  values ('00000000-0000-0000-0000-0000000000b1','post','p1','00000000-0000-0000-0000-0000000000c1','spam');
select 'Nach zweiter Meldung', count(*) from public.push_outbox where kind = 'report_new';
-- nach 11 Minuten wieder eine
update public.push_outbox set created_at = now() - interval '11 minutes' where kind = 'report_new';
insert into public.reports(reporter, target_type, target_id, reason) values ('00000000-0000-0000-0000-0000000000b1','spot','s1','privacy');
select 'Nach Pause', count(*) from public.push_outbox where kind = 'report_new';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) \g /dev/null
select 'Zusammenfassung', t($q$ select concat_ws(' ', open_count, newest_type, newest_reason, (oldest_at <= newest_at)::text) from public.mod_alert_summary() $q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false) \g /dev/null
select 'Normales Konto', t($q$ select open_count::text from public.mod_alert_summary() $q$);
select 'Normales Konto liest Mitteilungen', t($q$ select count(*)::text from public.push_outbox $q$);
reset role;
set role anon;
select 'Ohne Anmeldung', t($q$ select open_count::text from public.mod_alert_summary() $q$);
