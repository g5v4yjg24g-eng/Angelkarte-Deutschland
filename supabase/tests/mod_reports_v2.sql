\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),('00000000-0000-0000-0000-0000000000b1','bert','Bert'),('00000000-0000-0000-0000-0000000000c1','carl','Carl');
insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.friendships(requester, addressee, status, accepted_at) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','accepted',now());
-- Beitrag von C (öffentlich), zweimal gemeldet von B
insert into public.posts(id, author_id, caption, visibility, photo_paths, created_at) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','Böser Text','public','{x}',now());
insert into storage.objects(bucket_id, name) values ('post-photos','00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000001/1.jpg');
insert into public.reports(id, reporter, target_type, target_id, target_user, reason) values
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','post','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','abuse'),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','post','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','spam');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false); $$;
grant execute on function public.as_user(text) to authenticated;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Liste ohne Meldenden', t($q$ select string_agg(reason||':'||status||':'||same_target||':'||target_hidden, ',' order by reason) from public.mod_reports2('all') $q$);
select 'In Bearbeitung', t($q$ select public.mod_set_report_status('20000000-0000-0000-0000-000000000001','in_progress',null)::text $q$);
select 'Übersicht', t($q$ select concat_ws(' ', open_reports, in_progress) from public.mod_overview() $q$);
select 'Falscher Stand', t($q$ select public.mod_set_report_status('20000000-0000-0000-0000-000000000001','gelöscht',null)::text $q$);
select 'Meldenden ansehen', t($q$ select display_name from public.mod_report_reporter('20000000-0000-0000-0000-000000000001') $q$);
select 'Ausblenden ohne Grund', t($q$ select public.mod_hide_post('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','  ')::text $q$);
select 'Ausblenden', t($q$ select public.mod_hide_post('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Beleidigung')::text $q$);
select 'Doppelt ausblenden', t($q$ select public.mod_hide_post('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','nochmal')::text $q$);
select as_user('b1') \g /dev/null
select 'B sieht ausgeblendeten', t($q$ select count(*)::text from public.posts where id='10000000-0000-0000-0000-000000000001' $q$);
select 'B Entdecken', t($q$ select count(*)::text from public.discover_feed() $q$);
select 'B Feed (Freund)', t($q$ select count(*)::text from public.feed() $q$);
select 'B blendet selbst aus', t($q$ select public.mod_hide_post('10000000-0000-0000-0000-000000000001',null,'x')::text $q$);
select 'B liest Meldenden', t($q$ select display_name from public.mod_report_reporter('20000000-0000-0000-0000-000000000001') $q$);
select as_user('c1') \g /dev/null
select 'C sieht eigenen', t($q$ select visibility from public.posts where id='10000000-0000-0000-0000-000000000001' $q$);
select 'C macht wieder öffentlich', t($q$ with u as (update public.posts set visibility='public', updated_at=now() where id='10000000-0000-0000-0000-000000000001' returning visibility) select visibility from u $q$);
select 'C über publish_post', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000001','neu','public','{00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000001/1.jpg}'::text[],now()) $q$);
select 'Danach noch ausgeblendet', t($q$ select visibility from public.posts where id='10000000-0000-0000-0000-000000000001' $q$);
select as_user('a1') \g /dev/null
select 'Wiederherstellen', t($q$ select public.mod_restore_post('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','doch ok')::text $q$);
select 'Sichtbarkeit danach', t($q$ select visibility||' '||coalesce(hidden_reason,'-') from public.posts where id='10000000-0000-0000-0000-000000000001' $q$);
select 'Erledigt (alt)', t($q$ select public.mod_resolve('20000000-0000-0000-0000-000000000001','kein Verstoß')::text $q$);
select 'Stand', t($q$ select status||' '||(handled_at is not null)||' '||coalesce(handled_by_name,'-') from public.mod_reports2('all') where id='20000000-0000-0000-0000-000000000001' $q$);
select 'Verlauf', t($q$ select string_agg(action||':'||coalesce(detail,'-')||':'||moderator_name, ' > ') from public.mod_report_log('20000000-0000-0000-0000-000000000001') $q$);
select 'Entfernen ohne Grund', t($q$ select public.mod_delete_content('post','10000000-0000-0000-0000-000000000001',null,'')::text $q$);
-- Grenze: 50 Eingriffe in 24 h
reset role;
insert into public.moderation_log(moderator, action) select '00000000-0000-0000-0000-0000000000a1','delete_comment' from generate_series(1,50);
set role authenticated;
select as_user('a1') \g /dev/null
select 'Nach 50 Eingriffen', t($q$ select public.mod_delete_content('post','10000000-0000-0000-0000-000000000001',null,'Spam')::text $q$);
select 'Lesen geht weiter', t($q$ select count(*)::text from public.mod_reports2('all') $q$);
