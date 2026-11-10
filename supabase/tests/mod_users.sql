\pset tuples_only on
\pset format unaligned
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000a1','anna@example.org'),
  ('00000000-0000-0000-0000-0000000000b1','bert@example.org'),('00000000-0000-0000-0000-0000000000c1','Carl@Example.org'),
  ('00000000-0000-0000-0000-0000000000d1','dora@example.org');
insert into public.profiles(id, username, display_name, created_at) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert Hecht', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora', now() - interval '3 days');
-- A: Moderatorin mit Founder-Abzeichen; D: Moderatorin ohne
insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.user_badges(user_id, badge) values ('00000000-0000-0000-0000-0000000000a1','founder');
insert into public.reports(id, reporter, target_type, target_id, target_user, reason) values
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','user','c','00000000-0000-0000-0000-0000000000c1','spam');
insert into storage.objects(bucket_id, name) values ('post-photos','00000000-0000-0000-0000-0000000000b1/10000000-0000-0000-0000-000000000009/1.jpg');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;
create function public.as_user(u text, pw_age integer default null) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false),
         set_config('request.jwt.claims', case when pw_age is null then '{}' else
           json_build_object('amr', json_build_array(json_build_object('method','password','timestamp',
             extract(epoch from now())::bigint - pw_age)))::text end, false); $$;
grant execute on function public.as_user(text, integer) to authenticated;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Alle Konten', t($q$ select string_agg(username, ',') from public.mod_users() $q$);
select 'Seite 2', t($q$ select string_agg(username, ',') from public.mod_users('', 'all', (select joined from public.mod_users() offset 1 limit 1)) $q$);
select 'Name (Teil, groß/klein, @)', t($q$ select string_agg(username, ',') from public.mod_users('@HECH') $q$);
select 'Nutzer-ID', t($q$ select username from public.mod_users('00000000-0000-0000-0000-0000000000c1') $q$);
select 'Gemeldete', t($q$ select string_agg(username||':'||reports_against||'/'||open_reports, ',') from public.mod_users('', 'reported') $q$);
select 'Falscher Filter', t($q$ select count(*)::text from public.mod_users('', 'gelöscht') $q$);
select 'E-Mail (Founder, exakt)', t($q$ select username from public.mod_users('carl@example.ORG') $q$);
select 'E-Mail Teil findet nichts', t($q$ select count(*)::text from public.mod_users('example.org') $q$);
select 'E-Mail unbekannt', t($q$ select count(*)::text from public.mod_users('niemand@example.org') $q$);
select 'Darf E-Mail suchen', t($q$ select public.mod_can_search_email()::text $q$);
-- Verwarnungen
select 'Verwarnen ohne Grund', t($q$ select public.mod_add_warning('00000000-0000-0000-0000-0000000000c1','  ',null,null)::text $q$);
select 'Sich selbst verwarnen', t($q$ select public.mod_add_warning('00000000-0000-0000-0000-0000000000a1','x',null,null)::text $q$);
select 'Verwarnen', t($q$ select (public.mod_add_warning('00000000-0000-0000-0000-0000000000c1','Beleidigung','20000000-0000-0000-0000-000000000001',null) is not null)::text $q$);
select 'Verwarnen (alt)', t($q$ select public.mod_warn('00000000-0000-0000-0000-0000000000c1',null,'Spam')::text $q$);
select 'Verwarnen (alt) ohne Grund', t($q$ select public.mod_warn('00000000-0000-0000-0000-0000000000c1',null,'')::text $q$);
select 'Verwarnte', t($q$ select string_agg(username||':'||active_warnings, ',') from public.mod_users('', 'warned') $q$);
select 'Liste', t($q$ select string_agg(reason||':'||active||':'||moderator_name||':'||(report_id is not null), ',' order by reason) from public.mod_user_warnings('00000000-0000-0000-0000-0000000000c1') $q$);
select 'Zurücknehmen', t($q$ select public.mod_revoke_warning((select id from public.mod_user_warnings('00000000-0000-0000-0000-0000000000c1') where reason='Spam'),'Irrtum')::text $q$);
select 'Doppelt zurücknehmen', t($q$ select public.mod_revoke_warning((select id from public.mod_user_warnings('00000000-0000-0000-0000-0000000000c1') where reason='Spam'),'nochmal')::text $q$);
select 'Aktiv danach', t($q$ select active_warnings::text from public.mod_users('carl') $q$);
-- Sperren
select 'Dauerhaft ohne Passwort', t($q$ select public.mod_ban('00000000-0000-0000-0000-0000000000b1',null,'Hetze',null)::text $q$);
select as_user('a1', 600) \g /dev/null
select 'Dauerhaft mit altem Passwort (10 min)', t($q$ select public.mod_ban('00000000-0000-0000-0000-0000000000b1',null,'Hetze',null)::text $q$);
select as_user('a1', 30) \g /dev/null
select 'Dauerhaft mit frischem Passwort', t($q$ select public.mod_ban('00000000-0000-0000-0000-0000000000b1',null,'Hetze',null)::text $q$);
select as_user('a1') \g /dev/null
select '7 Tage ohne Passwort', t($q$ select public.mod_ban('00000000-0000-0000-0000-0000000000c1',7,'Spam',null)::text $q$);
select 'Gesperrte', t($q$ select string_agg(username||':'||(ban_until is null), ',') from public.mod_users('', 'banned') $q$);
-- Gesperrte Person mit noch gültigem Token schreibt nichts mehr
select as_user('b1') \g /dev/null
select 'Gesperrt: Beitrag', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000009','x','public','{00000000-0000-0000-0000-0000000000b1/10000000-0000-0000-0000-000000000009/1.jpg}'::text[],now()) $q$);
select 'Gesperrt: Profil ändern', t($q$ with u as (update public.profiles set display_name='Neu' where id='00000000-0000-0000-0000-0000000000b1' returning 'ok') select * from u $q$);
select 'Gesperrt: Freundschaft', t($q$ select public.send_friend_request('dora')::text $q$);
select 'Gesperrt: liest Verwarnungen', t($q$ select count(*)::text from public.warnings $q$);
-- Moderatorin ohne Founder: keine E-Mail-Suche
select as_user('d1') \g /dev/null
select 'D: E-Mail-Suche', t($q$ select count(*)::text from public.mod_users('carl@example.org') $q$);
select 'D: Darf E-Mail suchen', t($q$ select public.mod_can_search_email()::text $q$);
select 'D: Name', t($q$ select username from public.mod_users('carl') $q$);
select 'D: Profil von C bearbeiten geht für Moderation', t($q$ select public.mod_clear_profile('00000000-0000-0000-0000-0000000000c1',null,'test')::text $q$);
-- Normales Konto
reset role;
delete from public.bans where user_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select as_user('c1', 10) \g /dev/null
select 'C: Konten', t($q$ select count(*)::text from public.mod_users() $q$);
select 'C: Verwarnen', t($q$ select public.mod_add_warning('00000000-0000-0000-0000-0000000000b1','x',null,null)::text $q$);
select 'C: Zurücknehmen', t($q$ select public.mod_revoke_warning((select id from public.warnings limit 1),'x')::text $q$);
select 'C: eigene Verwarnungen lesen', t($q$ select count(*)::text from public.warnings $q$);
select 'C: Verwarnungsliste', t($q$ select count(*)::text from public.mod_user_warnings('00000000-0000-0000-0000-0000000000c1') $q$);
select 'C: E-Mail-Recht', t($q$ select public.mod_can_search_email()::text $q$);
select 'C: Hilfsfunktion Passwort', t($q$ select public.recent_password_auth(300)::text $q$);
select 'C: dauerhaft sperren', t($q$ select public.mod_ban('00000000-0000-0000-0000-0000000000b1',null,'x',null)::text $q$);
reset role;
select 'Protokoll', string_agg(action||':'||coalesce(detail,'-'), ' > ' order by created_at, action) from public.moderation_log;
select 'E-Mail nie im Protokoll', count(*) from public.moderation_log where detail ilike '%@%';
