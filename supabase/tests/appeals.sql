\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),('00000000-0000-0000-0000-0000000000d1','dora','Dora');
insert into public.moderators(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','founder');
-- B und C gesperrt; die Edge Function hat je Sperr-Mail einen Schlüssel angelegt (hier nur der Hash)
insert into public.bans(user_id, reason, until) values
  ('00000000-0000-0000-0000-0000000000b1','Spam', now() + interval '7 days'),
  ('00000000-0000-0000-0000-0000000000c1','Hass', null);
insert into public.appeal_tokens(token_hash, user_id) values
  (public.appeal_hash('schluessel-bert-0123456789abcdef'), '00000000-0000-0000-0000-0000000000b1'),
  (public.appeal_hash('schluessel-carl-0123456789abcdef'), '00000000-0000-0000-0000-0000000000c1'),
  (public.appeal_hash('schluessel-alt-0123456789abcdefg'), '00000000-0000-0000-0000-0000000000c1');
update public.appeal_tokens set expires_at = now() - interval '1 day' where token_hash = public.appeal_hash('schluessel-alt-0123456789abcdefg');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to anon, authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to anon, authenticated;
-- ohne Anmeldung, nur mit dem Link
set role anon;
select as_user('') \g /dev/null
select 'Info gültig', t($q$ select state||':'||(ban_until is not null)||':'||ban_reason from public.appeal_info('schluessel-bert-0123456789abcdef') $q$);
select 'Info falsch', t($q$ select state from public.appeal_info('falscher-schluessel-0123456789') $q$);
select 'Info abgelaufen', t($q$ select state from public.appeal_info('schluessel-alt-0123456789abcdefg') $q$);
select 'Info zu kurz', t($q$ select state from public.appeal_info('x') $q$);
select 'Einspruch zu kurz', t($q$ select public.submit_appeal('schluessel-bert-0123456789abcdef', 'kurz')::text $q$);
select 'Einspruch falscher Schlüssel', t($q$ select public.submit_appeal('falscher-schluessel-0123456789', 'Das war ein Irrtum, bitte prüfen.')::text $q$);
select 'Einspruch abgelaufen', t($q$ select public.submit_appeal('schluessel-alt-0123456789abcdefg', 'Das war ein Irrtum, bitte prüfen.')::text $q$);
select 'Einspruch B', t($q$ select public.submit_appeal('schluessel-bert-0123456789abcdef', '  Das war ein Irrtum, bitte prüfen.  ')::text $q$);
select 'Einspruch B zweimal', t($q$ select public.submit_appeal('schluessel-bert-0123456789abcdef', 'Noch einmal, bitte prüfen.')::text $q$);
select 'Info danach', t($q$ select state||':'||appeal_status from public.appeal_info('schluessel-bert-0123456789abcdef') $q$);
select 'Einspruch C', t($q$ select public.submit_appeal('schluessel-carl-0123456789abcdef', 'Ich habe nichts Falsches geschrieben.')::text $q$);
select 'Ohne Anmeldung: Liste', t($q$ select count(*)::text from public.mod_appeals('all') $q$);
select 'Ohne Anmeldung: Tabelle', t($q$ select count(*)::text from public.appeals $q$);
reset role;
select set_config('t.appeal', (select id::text from public.appeals order by created_at limit 1), false) \g /dev/null
set role authenticated;
select as_user('d1') \g /dev/null
select 'D: Liste', t($q$ select count(*)::text from public.mod_appeals('all') $q$);
select 'D: entscheidet', t($q$ select public.mod_decide_appeal(current_setting('t.appeal')::uuid, true, null)::text $q$);
select 'D: Tabelle', t($q$ select count(*)::text from public.appeals $q$);
select 'D: Schlüssel anlegen', t($q$ insert into public.appeal_tokens(token_hash, user_id) values (repeat('a', 64), '00000000-0000-0000-0000-0000000000d1') returning 'ok' $q$);
select as_user('a1') \g /dev/null
select 'Offen', t($q$ select string_agg(username||':'||body||':'||banned, ',' order by username) from public.mod_appeals() $q$);
select 'Übersicht', t($q$ select open_appeals::text from public.mod_overview() $q$);
select 'Ablehnen ohne Grund', t($q$ select public.mod_decide_appeal((select id from public.mod_appeals() where username='carl'), false, ' ')::text $q$);
select 'Ablehnen', t($q$ select public.mod_decide_appeal((select id from public.mod_appeals() where username='carl'), false, 'Beleidigungen sind belegt.')::text $q$);
select 'Annehmen', t($q$ select public.mod_decide_appeal((select id from public.mod_appeals() where username='bert'), true, 'Irrtum')::text $q$);
select 'Nochmal entscheiden', t($q$ select public.mod_decide_appeal((select id from public.mod_appeals('all') where username='bert'), false, 'doch nicht')::text $q$);
select 'Stand', t($q$ select string_agg(username||':'||status||':'||coalesce(decision_note,'-')||':'||banned||':'||decided_by_name, ',' order by username) from public.mod_appeals('all') $q$);
select 'Übersicht danach', t($q$ select open_appeals::text from public.mod_overview() $q$);
reset role;
select 'B entsperrt', not public.is_banned('00000000-0000-0000-0000-0000000000b1'), (select banned_until is null from auth.users where id = '00000000-0000-0000-0000-0000000000b1');
select 'C weiter gesperrt', public.is_banned('00000000-0000-0000-0000-0000000000c1');
select 'Protokoll', string_agg(action||':'||coalesce(detail,'-'), ' > ' order by created_at, action) from public.moderation_log;
select 'Mail-Ereignisse', string_agg(kind, ',') from public.ban_events;
