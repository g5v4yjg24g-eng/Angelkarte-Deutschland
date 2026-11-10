\pset tuples_only on
\pset format unaligned
-- a1 Anna (privat, Standard), b1 Bert (öffentlich), c1 Carl, d1 Dora (alte Freundschaft mit Anna), e1 Eva (alte Anfrage an Anna)
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000e1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora'),
  ('00000000-0000-0000-0000-0000000000e1','eva','Eva');
update public.profiles set is_private = false where username = 'bert';
insert into public.push_devices(token, user_id) values (repeat('a',64),'00000000-0000-0000-0000-0000000000a1'),
  (repeat('c',64),'00000000-0000-0000-0000-0000000000c1');
insert into public.posts(id, author_id, caption, visibility, photo_paths, created_at) values
  ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-0000000000a1','Follower','friends',array['00000000-0000-0000-0000-0000000000a1/x/0.jpg'], now() - interval '2 hours'),
  ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-0000000000a1','Nur ich','private',array['00000000-0000-0000-0000-0000000000a1/y/0.jpg'], now() - interval '1 hour');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false); $$;
grant execute on function public.as_user(text) to authenticated;
create function public.id(u text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000'||u)::uuid $$;
grant execute on function public.id(text) to authenticated;
set role authenticated;
-- Bestand wurde vor den Tests übernommen? (Migration läuft vor den Testdaten – daher hier nur Folgen neu)
select as_user('c1') \g /dev/null
select 'Carl folgt Bert (öffentlich)', t($q$ select public.follow_user('Bert ') $q$);
select 'Nochmal', t($q$ select public.follow_user('bert') $q$);
select 'Carl folgt Anna (privat)', t($q$ select public.follow_user('anna') $q$);
select 'Sich selbst', t($q$ select public.follow_user('carl') $q$);
select 'Unbekannt', t($q$ select public.follow_user('niemand') $q$);
select 'Direkt schreiben', t($q$ insert into public.follows values (id('c1'), id('d1'), 'accepted', now(), now()) returning 'ok' $q$);
select 'Carl sieht Annas Beitrag (angefragt)', t($q$ select count(*)::text from public.user_posts(id('a1')) $q$);
select 'Profil Anna (angefragt)', t($q$ select concat_ws(' ', relation, follows_me, is_private, follower_count, following_count, coalesce(bio, '-')) from public.user_profile_v2('anna') $q$);
select as_user('a1') \g /dev/null
select 'Anna: Anfragen', t($q$ select string_agg(username||':'||direction||':'||status, ',' order by username) from public.my_follows() $q$);
select 'Anna: Zahlen', t($q$ select concat_ws(' ', followers, following, requests) from public.my_follow_counts() $q$);
reset role;
select 'Anna: Mitteilungen', t($q$ select string_agg(kind, ',' order by created_at) from public.push_outbox where user_id = id('a1') $q$);
set role authenticated;
select 'Anna bestätigt Carl', t($q$ select public.respond_follow_request(id('c1'), true)::text $q$);
select 'Bestätigen erneut', t($q$ select public.respond_follow_request(id('c1'), true)::text $q$);
reset role;
select 'Carl: Mitteilungen', t($q$ select string_agg(kind, ',' order by created_at) from public.push_outbox where user_id = id('c1') $q$);
set role authenticated;
select as_user('c1') \g /dev/null
select 'Carl sieht Annas Beiträge', t($q$ select string_agg(caption, ',') from public.user_posts(id('a1')) $q$);
select 'Carl Feed', t($q$ select string_agg(caption, ',') from public.feed() $q$);
select 'Freunde Carl/Anna (einseitig)', t($q$ select public.are_friends(id('c1'), id('a1'))::text $q$);
select 'Carl teilt Spot mit Anna', t($q$ select (public.share_spot('p1', id('a1'), 'place', 'Spot', null, 51.0, 7.0) is not null)::text $q$);
select as_user('a1') \g /dev/null
select 'Anna folgt zurück', t($q$ select public.follow_user('carl') $q$);
select as_user('c1') \g /dev/null
select 'Carl: Anna folgt (Carl privat)', t($q$ select concat_ws(' ', relation, follows_me) from public.user_profile_v2('anna') $q$);
select 'Carl bestätigt Anna', t($q$ select public.respond_follow_request(id('a1'), true)::text $q$);
select 'Jetzt Freunde', t($q$ select public.are_friends(id('c1'), id('a1'))::text $q$);
select 'Alte Form: my_friends', t($q$ select string_agg(username||':'||status||':'||direction, ',' order by username) from public.my_friends() $q$);
select 'Alte Form: user_profile', t($q$ select relation||' '||friend_count from public.user_profile('anna') $q$);
select 'Alte Form: Suche', t($q$ select string_agg(username||':'||relation, ',' order by username) from public.search_users('ann') $q$);
-- Privat ausschalten bestätigt offene Anfragen
select as_user('d1') \g /dev/null
select 'Dora fragt Carl an', t($q$ select public.follow_user('carl') $q$);
select as_user('c1') \g /dev/null
select 'Carl: privat?', t($q$ select public.my_account_private()::text $q$);
select 'Carl öffentlich', t($q$ select public.set_account_private(false)::text $q$);
select 'Dora jetzt Follower', t($q$ select public.is_follower(id('d1'), id('c1'))::text $q$);
select 'Carl Zahlen', t($q$ select concat_ws(' ', followers, following, requests) from public.my_follow_counts() $q$);
select 'Follower entfernen', t($q$ select public.remove_follower(id('d1'))::text $q$);
select 'Dora noch Follower', t($q$ select public.is_follower(id('d1'), id('c1'))::text $q$);
-- Entfolgen
select 'Carl entfolgt Bert', t($q$ select public.unfollow_user(id('b1'))::text $q$);
select 'Carl folgt Bert noch', t($q$ select public.is_follower(id('c1'), id('b1'))::text $q$);
-- Blockieren beendet das Folgen
select as_user('a1') \g /dev/null
select 'Anna blockiert Carl', t($q$ select public.block_user(id('c1'))::text $q$);
select 'Folgen übrig', t($q$ select count(*)::text from public.follows where id('c1') in (follower, followee) and id('a1') in (follower, followee) $q$);
select as_user('c1') \g /dev/null
select 'Blockiert: folgen', t($q$ select public.follow_user('anna') $q$);
select 'Blockiert: Profil', t($q$ select count(*)::text from public.user_profile_v2('anna') $q$);
-- Erfolge mit „friends“ = Follower
select as_user('e1') \g /dev/null
select 'Eva folgt Bert', t($q$ select public.follow_user('bert') $q$);
select 'Eva sieht Berts Erfolge', t($q$ select bool_and(visible)::text from public.user_achievements(id('b1')) $q$);
select as_user('d1') \g /dev/null
select 'Dora (kein Follower) sieht Berts Erfolge', t($q$ select bool_and(visible)::text from public.user_achievements(id('b1')) $q$);
-- Gesperrt
reset role;
insert into public.bans(user_id, reason) values (id('e1'), 'Test');
set role authenticated;
select as_user('e1') \g /dev/null
select 'Gesperrt folgt', t($q$ select public.follow_user('dora') $q$);
-- Grenze
reset role;
insert into auth.users(id) select ('00000000-0000-0000-0000-'||lpad(n::text, 12, '0'))::uuid from generate_series(1000, 1200) n;
insert into public.profiles(id, username, display_name, is_private)
  select ('00000000-0000-0000-0000-'||lpad(n::text, 12, '0'))::uuid, 'nutzer'||n, 'N'||n, false from generate_series(1000, 1200) n;
set role authenticated;
select as_user('d1') \g /dev/null
select 'Viele folgen', t($q$ select count(*)::text from (select public.follow_user('nutzer'||n) from generate_series(1000, 1199) n) x $q$);
select 'Grenze', t($q$ select public.follow_user('nutzer1200') $q$);
-- Ohne Anmeldung
reset role;
set role anon;
select 'Anon folgt', t($q$ select public.follow_user('anna') $q$);
