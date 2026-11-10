-- Fangpunkt – Einsprüche gegen Sperren (Entscheidung Nutzer 2026-11-10: Link in der Sperr-Mail).
-- Gesperrte Personen können sich nicht anmelden. Deshalb enthält die Sperr-Mail einen persönlichen Link mit einem
-- zufälligen Schlüssel (erzeugt von der Edge Function, hier nur als SHA-256-Hash gespeichert). Damit lässt sich ohne
-- Anmeldung genau ein Einspruch je Sperre einlegen, solange die Sperre gilt (höchstens 30 Tage). Moderatoren entscheiden
-- im Admin-Bereich: annehmen hebt die Sperre auf (Mail wie bisher), ablehnen schickt eine Mail mit Begründung.
-- Nur erweiternd: es wird nichts gelöscht.

alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban',
                    'unban', 'resolve', 'in_progress', 'reopen', 'hide_post', 'restore_post', 'view_reporter',
                    'revoke_warning', 'search_email', 'block_name', 'unblock_name', 'publish_rules',
                    'appeal_accept', 'appeal_reject'));

-- Schlüssel je Sperr-Mail (nur der Hash; der Schlüssel selbst steht nur in der Mail)
create table public.appeal_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  ban_event uuid references public.ban_events (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz
);
alter table public.appeal_tokens enable row level security;
revoke all on public.appeal_tokens from anon, authenticated;
grant insert on public.appeal_tokens to service_role;

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique references public.appeal_tokens (token_hash),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  -- Mail an moderation@ (neu) bzw. an die Person (abgelehnt)
  notified_at timestamptz,
  decision_notified_at timestamptz
);
create index appeals_status on public.appeals (status, created_at desc);
alter table public.appeals enable row level security;
revoke all on public.appeals from anon, authenticated;
grant select, update (notified_at, decision_notified_at) on public.appeals to service_role;

create function public.appeal_hash(token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(token, ''), 'UTF8')), 'hex');
$$;

-- Für die Einspruchsseite: gilt der Schlüssel noch? Dazu Sperre (bis wann, Grund) – nur für den Inhaber des Links.
-- state: open (Einspruch möglich), used (schon eingelegt), ended (Sperre vorbei), invalid (unbekannt/abgelaufen)
create function public.appeal_info(token text)
returns table (state text, ban_until timestamptz, ban_reason text, appeal_status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  tok public.appeal_tokens;
begin
  if token is null or char_length(token) not between 20 and 200 then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text;
    return;
  end if;
  select * into tok from public.appeal_tokens t where t.token_hash = public.appeal_hash(token);
  if not found or tok.expires_at < now() then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text;
    return;
  end if;
  return query
  select case
           when tok.used_at is not null then 'used'
           when not public.is_banned(tok.user_id) then 'ended'
           else 'open'
         end,
         b.until, b.reason,
         (select a.status from public.appeals a where a.token_hash = tok.token_hash)
  from (select 1) x left join public.bans b on b.user_id = tok.user_id;
end;
$$;
revoke execute on function public.appeal_info(text) from public;
grant execute on function public.appeal_info(text) to anon, authenticated;

-- Einspruch einlegen (ohne Anmeldung, nur mit gültigem Schlüssel, genau einmal, solange die Sperre gilt)
create function public.submit_appeal(token text, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tok public.appeal_tokens;
  new_id uuid;
begin
  if token is null or char_length(token) not between 20 and 200 then raise exception 'invalid_token'; end if;
  select * into tok from public.appeal_tokens t where t.token_hash = public.appeal_hash(token) for update;
  if not found or tok.expires_at < now() then raise exception 'invalid_token'; end if;
  if tok.used_at is not null then raise exception 'already_used'; end if;
  if not public.is_banned(tok.user_id) then raise exception 'not_banned'; end if;
  if char_length(btrim(coalesce(body, ''))) < 10 then raise exception 'too_short'; end if;
  if char_length(btrim(body)) > 2000 then raise exception 'too_long'; end if;
  update public.appeal_tokens t set used_at = now() where t.token_hash = tok.token_hash;
  insert into public.appeals (user_id, token_hash, body) values (tok.user_id, tok.token_hash, btrim(body))
  returning id into new_id;
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
    body := jsonb_build_object('appeal', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;
revoke execute on function public.submit_appeal(text, text) from public;
grant execute on function public.submit_appeal(text, text) to anon, authenticated;

-- Admin: Einsprüche nach Stand, mit Person und Sperre
create function public.mod_appeals(state text default 'open')
returns table (
  id uuid, user_id uuid, username text, display_name text, body text, status text, created_at timestamptz,
  decided_at timestamptz, decided_by_name text, decision_note text, banned boolean, ban_until timestamptz,
  ban_reason text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  if state not in ('open', 'accepted', 'rejected', 'all') then raise exception 'bad_status'; end if;
  return query
  select a.id, a.user_id, p.username, p.display_name, a.body, a.status, a.created_at, a.decided_at, dp.display_name,
         a.decision_note, public.is_banned(a.user_id), b.until, b.reason
  from public.appeals a
  left join public.profiles p on p.id = a.user_id
  left join public.profiles dp on dp.id = a.decided_by
  left join public.bans b on b.user_id = a.user_id
  where state = 'all' or a.status = state
  order by a.created_at desc
  limit 200;
end;
$$;
revoke execute on function public.mod_appeals(text) from public, anon;
grant execute on function public.mod_appeals(text) to authenticated;

-- Entscheiden: annehmen hebt die Sperre auf (mod_unban schickt die bekannte Mail), ablehnen braucht eine Begründung
-- und schickt sie per Mail. Jede Entscheidung steht im Protokoll; entschieden ist entschieden.
create function public.mod_decide_appeal(appeal uuid, accept boolean, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.appeals;
begin
  perform public.require_moderator();
  select * into a from public.appeals x where x.id = appeal for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'open' then raise exception 'already_decided'; end if;
  if a.user_id = auth.uid() then raise exception 'self'; end if;
  if not accept and char_length(btrim(coalesce(note, ''))) = 0 then raise exception 'no_reason'; end if;
  update public.appeals x set status = case when accept then 'accepted' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid(), decision_note = nullif(btrim(note), '')
  where x.id = appeal;
  perform public.mod_log(case when accept then 'appeal_accept' else 'appeal_reject' end, a.user_id, null, note);
  if accept then
    if public.is_banned(a.user_id) or exists (select 1 from public.bans b where b.user_id = a.user_id) then
      perform public.mod_unban(a.user_id, coalesce(nullif(btrim(note), ''), 'Einspruch angenommen'));
    end if;
  else
    perform net.http_post(
      url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
      body := jsonb_build_object('appeal_decision', appeal),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
end;
$$;
revoke execute on function public.mod_decide_appeal(uuid, boolean, text) from public, anon;
grant execute on function public.mod_decide_appeal(uuid, boolean, text) to authenticated;

-- Übersicht: jetzt mit offenen Einsprüchen
drop function public.mod_overview();
create function public.mod_overview()
returns table (
  open_reports integer, in_progress integer, done_today integer, banned_now integer, new_users_7d integer,
  open_appeals integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query select
    (select count(*)::integer from public.reports r where r.status = 'open'),
    (select count(*)::integer from public.reports r where r.status = 'in_progress'),
    (select count(*)::integer from public.moderation_log l
       where l.action = 'resolve'
         and l.created_at >= (date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')),
    (select count(*)::integer from public.bans b where b.until is null or b.until > now()),
    (select count(*)::integer from public.profiles p where p.created_at > now() - interval '7 days'),
    (select count(*)::integer from public.appeals a where a.status = 'open');
end;
$$;
revoke execute on function public.mod_overview() from public, anon;
grant execute on function public.mod_overview() to authenticated;

notify pgrst, 'reload schema';
