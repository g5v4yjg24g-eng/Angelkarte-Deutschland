\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1');
insert into public.profiles(id, username, display_name, created_at) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl', now() - interval '1 hour');
-- A ist Moderatorin (nur per SQL-Editor möglich)
insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.reports(reporter, target_type, target_id, target_user, reason, status) values
  ('00000000-0000-0000-0000-0000000000b1','user','x','00000000-0000-0000-0000-0000000000c1','spam','open'),
  ('00000000-0000-0000-0000-0000000000b1','user','y','00000000-0000-0000-0000-0000000000c1','abuse','open'),
  ('00000000-0000-0000-0000-0000000000c1','user','z','00000000-0000-0000-0000-0000000000b1','other','done');
insert into public.moderation_log(moderator, action, target_user, created_at) values
  ('00000000-0000-0000-0000-0000000000a1','resolve','00000000-0000-0000-0000-0000000000b1', now()),
  ('00000000-0000-0000-0000-0000000000a1','resolve','00000000-0000-0000-0000-0000000000b1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a1','warn','00000000-0000-0000-0000-0000000000c1', now());
insert into public.bans(user_id, reason, until) values
  ('00000000-0000-0000-0000-0000000000c1','Spam', now() + interval '7 days');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) \g /dev/null
select 'Moderatorin', t($q$ select concat_ws(' ', open_reports, done_today, banned_now, new_users_7d) from public.mod_overview() $q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false) \g /dev/null
select 'Normales Konto', t($q$ select open_reports::text from public.mod_overview() $q$);
select 'Normales Konto liest Meldungen', t($q$ select count(*)::text from public.reports $q$);
select 'Normales Konto liest Protokoll', t($q$ select count(*)::text from public.moderation_log $q$);
select 'Normales Konto macht sich zum Moderator', t($q$ insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000b1') returning 'ok' $q$);
reset role;
set role anon;
select 'Ohne Anmeldung', t($q$ select open_reports::text from public.mod_overview() $q$);
