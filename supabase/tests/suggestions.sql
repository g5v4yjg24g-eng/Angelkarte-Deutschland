\pset tuples_only on
\pset format unaligned
-- „Angler entdecken“: Empfehlung, Einstellungen, Ausblenden, Rechte.
-- a1 Anna (fragt ab), b1 Bert, c1 Carl (beide folgt Anna), d1 Dora (folgen Bert und Carl), e1 Eva (Bert; zwei gemeinsame Gewässer),
-- f1 Finn (ein Gewässer, 57 km), g1 Gero (München), h1 Hans (blockiert), i1 Ida (gesperrt), j1 Jo (nicht auffindbar),
-- k1 Kai (Anna hat angefragt), l1 Lena (Gewässer aus), m1 Mia (97 km), n1 Nora (111 km), o1 Otto (Erfolge für alle), p1 Pia (nichts)
insert into auth.users(id)
select ('00000000-0000-0000-0000-0000000000' || u)::uuid from unnest(array['a1','b1','c1','d1','e1','f1','a2','b2','c2','d2','e2','f2','a3','b3','c3','d3']) u;
insert into public.profiles(id, username, display_name)
select ('00000000-0000-0000-0000-0000000000' || u)::uuid, n, initcap(n)
from (values ('a1','anna'),('b1','bert'),('c1','carl'),('d1','dora'),('e1','eva'),('f1','finn'),('a2','gero'),('b2','hans'),
             ('c2','ida'),('d2','jo_'),('e2','kai'),('f2','lena'),('a3','mia'),('b3','nora'),('c3','otto'),('d3','pia')) v(u, n);
create function public.id(u text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000'||u)::uuid $$;
grant execute on function public.id(text) to authenticated;
-- Folgen (bestätigt), Anna → Kai nur angefragt
insert into public.follows(follower, followee, status) values
  (id('a1'), id('b1'), 'accepted'), (id('a1'), id('c1'), 'accepted'), (id('a1'), id('e2'), 'pending'),
  (id('b1'), id('d1'), 'accepted'), (id('c1'), id('d1'), 'accepted'), (id('b1'), id('e1'), 'accepted'),
  (id('b1'), id('b2'), 'accepted'), (id('b1'), id('c2'), 'accepted'), (id('b1'), id('d2'), 'accepted'),
  (id('b1'), id('e2'), 'accepted'), (id('b1'), id('c3'), 'accepted'),
  -- eine nur angefragte Folge von Bert zählt nicht
  (id('b1'), id('a3'), 'pending');
insert into public.blocks(blocker, blocked) values (id('a1'), id('b2'));
insert into public.bans(user_id, reason) values (id('c2'), 'Test');
insert into public.suggestion_prefs(user_id, discoverable) values (id('d2'), false);
-- Erfolge: Otto für alle, Dora nur für Follower
update public.profiles set achievements_visibility = 'public' where id = id('c3');
insert into public.user_achievements(user_id, key, unlocked_at) values
  (id('c3'), 'catches:gold', now() - interval '3 days'), (id('c3'), 'first', now() - interval '9 days'),
  (id('d1'), 'catches:silver', now() - interval '2 days');
-- Gewässer
insert into public.user_waters(user_id, water_id, name, rank) values
  (id('a1'), 'osm:w1', 'De Wittsee', 0), (id('a1'), 'osm:w2', 'Rhein', 1), (id('a1'), 'osm:w3', 'Maas', 2),
  (id('e1'), 'osm:w1', 'de wittsee (anders geschrieben)', 0), (id('e1'), 'osm:w2', 'Rhein', 1),
  (id('f1'), 'osm:w1', 'De Wittsee', 0),
  (id('f2'), 'osm:w1', 'De Wittsee', 0);
insert into public.suggestion_prefs(user_id, waters_on) values (id('f2'), false);
-- Regionen (Rasterpunkte)
insert into public.suggestion_prefs(user_id, region_lat, region_lng) values
  (id('a1'), 51.3, 6.2), (id('f1'), 51.4, 7.0), (id('a2'), 48.1, 11.6), (id('a3'), 51.3, 7.6), (id('b3'), 51.3, 7.8)
on conflict (user_id) do update set region_lat = excluded.region_lat, region_lng = excluded.region_lng;
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false); $$;
grant execute on function public.as_user(text) to authenticated;
set role authenticated;
select as_user('a1') \g /dev/null
-- Alles, was der Server zurückgibt: Name:gemeinsame Kontakte:Gewässer:Region:Erfolge
select 'Anna: Vorschläge', t($q$ select string_agg(username||':'||common_friends||':'||coalesce(shared_water,'-')||':'||same_region||':'||coalesce(array_to_string(achievement_keys,'+'),'-'), E'\n' order by username) from public.suggest_anglers(30) $q$);
select 'Anna: die ersten drei (Reihenfolge)', t($q$ select string_agg(username, ',' order by score desc) from (select * from public.suggest_anglers(3)) x $q$);
select 'Anna: höchstens', t($q$ select count(*)::text from public.suggest_anglers(2) $q$);
select 'Anna: Einstellungen', t($q$ select concat_ws(' ', discoverable, waters_on, region_on) from public.my_suggestion_prefs() $q$);
-- Ausblenden
select 'Dora ausblenden', t($q$ select public.dismiss_suggestion(id('d1'))::text $q$);
select 'Anna ohne Dora', t($q$ select string_agg(username, ',' order by username) filter (where username = 'dora') from public.suggest_anglers(30) $q$);
select 'Sich selbst ausblenden', t($q$ select public.dismiss_suggestion(id('a1'))::text $q$);
select 'Unbekannte ausblenden', t($q$ select public.dismiss_suggestion('00000000-0000-0000-0000-0000000000ff')::text $q$);
select 'Dora nochmal ausblenden', t($q$ select public.dismiss_suggestion(id('d1'))::text $q$);
reset role;
select 'Dora Zähler', n::text from public.suggestion_dismissals where user_id = id('a1') and other = id('d1');
-- nach Ablauf der Pause (n=2 → 60 Tage) kommt Dora zurück, aber mit halbem Gewicht je Ausblenden
update public.suggestion_dismissals set last_at = now() - interval '61 days' where user_id = id('a1');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Dora nach der Pause', t($q$ select string_agg(username, ',') from public.suggest_anglers(30) where username = 'dora' $q$);
select 'Dora nach der Pause: Platz unter den ersten vier', t($q$ select (exists (select 1 from (select username from public.suggest_anglers(30) order by score desc limit 4) x where username = 'dora'))::text $q$);
-- Finn: eine Region und ein Gewässer, folgt niemandem
select as_user('f1') \g /dev/null
select 'Finn: Vorschläge', t($q$ select string_agg(username||':'||common_friends||':'||coalesce(shared_water,'-')||':'||same_region, ', ' order by username) from public.suggest_anglers(30) $q$);
-- Pia: nichts freigegeben, nichts gefolgt
select as_user('d3') \g /dev/null
select 'Pia: Vorschläge', t($q$ select count(*)::text from public.suggest_anglers(30) $q$);
-- Mia: nur Region (97 km von Anna)
select as_user('a3') \g /dev/null
select 'Mia: Vorschläge', t($q$ select string_agg(username, ',' order by username) from public.suggest_anglers(30) $q$);
-- Anna schaltet Region aus: Finn und Mia bleiben nur über andere Kriterien
select as_user('a1') \g /dev/null
select 'Region aus', t($q$ select public.clear_my_region()::text $q$);
select 'Anna ohne Region', t($q$ select string_agg(username||':'||same_region, ',' order by username) from public.suggest_anglers(30) $q$);
-- Region setzen: wird gerundet, außerhalb von Deutschland und Umgebung abgelehnt
select 'Region setzen', t($q$ select public.set_my_region(51.349, 6.251)::text $q$);
select 'Region gerundet', t($q$ select region_on::text from public.my_suggestion_prefs() $q$);
select 'Region außerhalb', t($q$ select public.set_my_region(10, 10)::text $q$);
select 'Region leer', t($q$ select public.set_my_region(null, 6)::text $q$);
reset role;
select 'Gespeichert', region_lat || ' / ' || region_lng from public.suggestion_prefs where user_id = id('a1');
set role authenticated;
select as_user('a1') \g /dev/null
-- nicht auffindbar: Anna verschwindet für andere
select 'Anna nicht auffindbar', t($q$ select public.set_my_suggestion_prefs(false, true)::text $q$);
select as_user('f1') \g /dev/null
select 'Finn sieht Anna nicht', t($q$ select count(*)::text from public.suggest_anglers(30) where username = 'anna' $q$);
select as_user('a1') \g /dev/null
select 'Anna wieder auffindbar', t($q$ select public.set_my_suggestion_prefs(true, true)::text $q$);
select as_user('f1') \g /dev/null
select 'Finn sieht Anna wieder', t($q$ select count(*)::text from public.suggest_anglers(30) where username = 'anna' $q$);
-- Gewässer: prüfen, ersetzen, ausschalten
select as_user('a1') \g /dev/null
select 'Gewässer ersetzen', t($q$ select public.set_my_waters('[{"id":"osm:w1","name":"De Wittsee"},{"id":"osm:r77","name":"Niers"}]'::jsonb)::text $q$);
select 'Gewässer Kennung falsch', t($q$ select public.set_my_waters('[{"id":"abc","name":"X"}]'::jsonb)::text $q$);
select 'Gewässer ohne Namen', t($q$ select public.set_my_waters('[{"id":"osm:w5","name":"  "}]'::jsonb)::text $q$);
select 'Gewässer zu viele', t($q$ select public.set_my_waters((select jsonb_agg(jsonb_build_object('id','osm:w'||g,'name','G'||g)) from generate_series(1,31) g))::text $q$);
select 'Gewässer kein Array', t($q$ select public.set_my_waters('{"id":"osm:w1"}'::jsonb)::text $q$);
reset role;
select 'Annas Gewässer', string_agg(water_id || '=' || name, ', ' order by rank) from public.user_waters where user_id = id('a1');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Gewässer aus', t($q$ select public.set_my_suggestion_prefs(true, false)::text $q$);
reset role;
select 'Annas Gewässer nach Aus', count(*)::text from public.user_waters where user_id = id('a1');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Gewässer bei Aus senden', t($q$ select public.set_my_waters('[{"id":"osm:w1","name":"De Wittsee"}]'::jsonb)::text $q$);
-- Rechte: keine Tabellen direkt, nichts ohne Anmeldung
select 'Direkt lesen: Einstellungen', t($q$ select count(*)::text from public.suggestion_prefs $q$);
select 'Direkt lesen: Gewässer', t($q$ select count(*)::text from public.user_waters $q$);
select 'Direkt lesen: Ausgeblendet', t($q$ select count(*)::text from public.suggestion_dismissals $q$);
select 'Direkt schreiben', t($q$ insert into public.suggestion_prefs(user_id, region_lat, region_lng) values (id('a1'), 51, 6) returning 'ok' $q$);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select 'Anon: Vorschläge', t($q$ select count(*)::text from public.suggest_anglers(5) $q$);
select 'Anon: Einstellungen', t($q$ select count(*)::text from public.my_suggestion_prefs() $q$);
select 'Anon: Region', t($q$ select public.set_my_region(51, 6)::text $q$);
select 'Anon: Gewässer', t($q$ select public.set_my_waters('[]'::jsonb)::text $q$);
select 'Anon: Ausblenden', t($q$ select public.dismiss_suggestion(id('d1'))::text $q$);
reset role;
