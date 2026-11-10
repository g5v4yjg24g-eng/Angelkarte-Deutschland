\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),('00000000-0000-0000-0000-0000000000b1','bert','Bert'),('00000000-0000-0000-0000-0000000000d1','dora','Dora');
insert into public.moderators(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','founder'),('00000000-0000-0000-0000-0000000000d1','moderator');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to anon, authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to anon, authenticated;
-- ohne Konto lesbar
set role anon;
select as_user('') \g /dev/null
select 'Ohne Konto: aktuelle Fassung', t($q$ select version||':'||cardinality(items)||':'||left(intro, 9) from public.current_rules() $q$);
select 'Ohne Konto: zustimmen', t($q$ select public.accept_rules(1)::text $q$);
select 'Ohne Konto: Tabelle Zustimmungen', t($q$ select count(*)::text from public.rules_consents $q$);
reset role;
set role authenticated;
select as_user('b1') \g /dev/null
select 'B: Zustimmung vorher', t($q$ select public.my_rules_consent()::text $q$);
select 'B: stimmt zu', t($q$ select public.accept_rules(1)::text $q$);
select 'B: doppelt', t($q$ select public.accept_rules(1)::text $q$);
select 'B: unbekannte Fassung', t($q$ select public.accept_rules(9)::text $q$);
select 'B: Zustimmung', t($q$ select public.my_rules_consent()::text $q$);
select 'B: veröffentlicht', t($q$ select public.mod_publish_rules('x', array['y'], 'z')::text $q$);
select 'B: Verlauf', t($q$ select count(*)::text from public.mod_rules_history() $q$);
select 'B: schreibt Regeln direkt', t($q$ insert into public.community_rules(version, intro, items) values (5,'x','{y}') returning 'ok' $q$);
select 'B: schreibt Zustimmung direkt', t($q$ insert into public.rules_consents(user_id, version) values ('00000000-0000-0000-0000-0000000000b1', 1) returning 'ok' $q$);
select as_user('d1') \g /dev/null
select 'D (Moderator): veröffentlicht', t($q$ select public.mod_publish_rules('x', array['y'], 'z')::text $q$);
select 'D: Verlauf', t($q$ select string_agg(version||':'||consents||'/'||accounts, ',') from public.mod_rules_history() $q$);
select as_user('a1') \g /dev/null
select 'A: ohne Änderungsgrund', t($q$ select public.mod_publish_rules('Intro', array['Regel 1'], '  ')::text $q$);
select 'A: leer', t($q$ select public.mod_publish_rules('Intro', array['  ', ''], 'neu')::text $q$);
select 'A: zu viele', t($q$ select public.mod_publish_rules('Intro', array_fill('x'::text, array[16]), 'neu')::text $q$);
select 'A: veröffentlicht', t($q$ select public.mod_publish_rules(' Neue Einleitung ', array[' Regel A ', '', 'Regel B'], 'Regel B ergänzt')::text $q$);
select 'Aktuell', t($q$ select version||':'||array_to_string(items, '|')||':'||intro||':'||summary from public.current_rules() $q$);
select 'Verlauf', t($q$ select string_agg(version||':'||coalesce(publisher_name,'-')||':'||consents, ',' order by version) from public.mod_rules_history() $q$);
select as_user('b1') \g /dev/null
select 'B: Zustimmung nach neuer Fassung', t($q$ select public.my_rules_consent()::text $q$);
select 'B: stimmt neu zu', t($q$ select public.accept_rules(2)::text $q$);
select 'B: Zustimmung danach', t($q$ select public.my_rules_consent()::text $q$);
select 'B: sieht nur eigene', t($q$ select count(*)::text from public.rules_consents $q$);
reset role;
select 'Protokoll', string_agg(action||':'||detail, ' > ') from public.moderation_log;
