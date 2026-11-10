-- QS Admin-Bereich: Rechte-Gesamtprüfung. Prüft automatisch ALLE Funktionen, nicht nur bekannte – so fällt eine
-- künftig vergessene Prüfung sofort auf.
--  1. Jede Funktion mod_* lehnt ein normales Konto und einen Aufruf ohne Anmeldung ab.
--  2. Ohne Anmeldung (anon) sind nur die ausdrücklich gewollten Funktionen aufrufbar.
--  3. Jede Tabelle in public hat Zeilenschutz (RLS) eingeschaltet.
--  4. Jede security-definer-Funktion in public hat einen festen search_path.
--  5. Rollen und Moderatoren lassen sich aus der App heraus nicht vergeben.
\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000b1');
insert into public.profiles(id, username, display_name) values ('00000000-0000-0000-0000-0000000000b1','bert','Bert');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to anon, authenticated;
-- Aufrufe aller mod_*-Funktionen mit leeren Argumenten
create temp table calls as
select p.proname as name,
       format('select public.%I(%s)::text', p.proname,
              coalesce((select string_agg('null::' || format_type(t, null), ', ' order by o)
                        from unnest(p.proargtypes) with ordinality as a(t, o)), '')) as q
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'mod\_%' and p.prokind = 'f';
grant select on calls to anon, authenticated;
select 'Geprüfte mod_*-Funktionen', count(*) from calls;
-- Diese zwei verraten nur den eigenen Stand und dürfen für alle Angemeldeten antworten
create temp table own_state(name text primary key);
insert into own_state values ('mod_can_search_email'), ('mod_my_role');
grant select on own_state to anon, authenticated;
-- 1a. normales Konto
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
select 'Normales Konto kommt durch', coalesce(string_agg(name, ', '), 'keine')
from (select name, public.t(q) r from calls where name not in (select name from own_state)) x
where r not like 'FEHLER: not_moderator%' and r not like 'FEHLER: permission denied%';
select 'Eigener Stand für normales Konto', string_agg(name || '=' || public.t(q), ', ' order by name)
from calls where name in (select name from own_state);
-- 1b. ohne Anmeldung
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select 'Ohne Anmeldung kommt durch', coalesce(string_agg(name, ', '), 'keine')
from (select name, public.t(q) r from calls) x
where r not like 'FEHLER: permission denied%' and r not like 'FEHLER: not_moderator%';
reset role;
-- 2. Was darf anon aufrufen? (muss genau diese Liste sein)
select 'Ohne Anmeldung aufrufbar', string_agg(p.proname, ', ' order by p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 't'
  and has_function_privilege('anon', p.oid, 'execute');
-- 3. Tabellen ohne RLS
select 'Tabellen ohne RLS', coalesce(string_agg(c.relname, ', '), 'keine')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- 4. security definer ohne festen search_path
select 'security definer ohne search_path', coalesce(string_agg(p.proname, ', '), 'keine')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
-- 5. Rechte vergeben aus der App
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
select 'Moderator werden', public.t($q$ insert into public.moderators(user_id) values ('00000000-0000-0000-0000-0000000000b1') returning 'ok' $q$);
select 'Founder-Abzeichen', public.t($q$ insert into public.user_badges(user_id, badge) values ('00000000-0000-0000-0000-0000000000b1','founder') returning 'ok' $q$);
select 'Sperre aufheben', public.t($q$ delete from public.bans returning 'ok' $q$);
select 'Protokoll lesen', public.t($q$ select count(*)::text from public.moderation_log $q$);
select 'Protokoll fälschen', public.t($q$ insert into public.moderation_log(action) values ('ban') returning 'ok' $q$);
select 'Meldungen lesen', public.t($q$ select count(*)::text from public.reports $q$);
select 'Verwarnungen lesen', public.t($q$ select count(*)::text from public.warnings $q$);
select 'Einsprüche lesen', public.t($q$ select count(*)::text from public.appeals $q$);
select 'Gesperrte Namen lesen', public.t($q$ select count(*)::text from public.blocked_usernames $q$);
select 'Regeln überschreiben', public.t($q$ update public.community_rules set intro = 'x' returning 'ok' $q$);
select 'Gerade gesperrt?', public.t($q$ select public.is_banned('00000000-0000-0000-0000-0000000000b1')::text $q$);
reset role;
