-- Fangpunkt – Community-Regeln mit Versionen (Wunsch Nutzer 2026-11-10: im Admin-Bereich bearbeitbar, bei neuer
-- Fassung stimmen angemeldete Nutzer einmal neu zu). Nur erweiternd: es wird nichts gelöscht.
-- Jede Veröffentlichung ist eine neue, unveränderliche Version (Verlauf bleibt vollständig). Veröffentlichen darf nur
-- die Rolle Founder (Schutz, falls ein Moderatorenkonto in falsche Hände gerät). Lesen dürfen alle, auch ohne Konto
-- (Registrierung zeigt die Regeln vor dem Anlegen des Kontos).

alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'clear_profile', 'warn', 'ban',
                    'unban', 'resolve', 'in_progress', 'reopen', 'hide_post', 'restore_post', 'view_reporter',
                    'revoke_warning', 'search_email', 'block_name', 'unblock_name', 'publish_rules'));

create table public.community_rules (
  version integer primary key check (version >= 1),
  intro text not null check (char_length(btrim(intro)) between 1 and 500),
  items text[] not null check (cardinality(items) between 1 and 15),
  -- Was hat sich geändert? (steht im Fenster, wenn Nutzer neu zustimmen sollen)
  summary text check (summary is null or char_length(summary) <= 300),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);
alter table public.community_rules enable row level security;
create policy "Regeln lesen" on public.community_rules for select to anon, authenticated using (true);
revoke all on public.community_rules from anon, authenticated;
grant select (version, intro, items, summary, published_at) on public.community_rules to anon, authenticated;

-- Fassung 1 = die Regeln, die bisher fest in der App stehen (wortgleich)
insert into public.community_rules (version, intro, items, summary, published_at) values (
  1,
  'Fangpunkt lebt davon, dass sich alle wohlfühlen. Mit einem Konto hältst du dich an diese Regeln:',
  array[
    'Keine beleidigenden, bedrohenden oder diskriminierenden Inhalte.',
    'Keine Nacktheit, keine Gewalt, keine Tierquälerei und keine anstößigen Bilder.',
    'Kein Spam und keine Werbung.',
    'Nur eigene Fotos und keine Daten anderer ohne deren Zustimmung.',
    'Verstöße können gemeldet werden. Wir prüfen jede Meldung innerhalb von 24 Stunden und löschen unzulässige Inhalte; wer gegen die Regeln verstößt, wird ausgeschlossen.'
  ],
  null,
  '2026-11-03T00:00:00Z'
);

-- Zustimmungen: je Konto und Version höchstens eine Zeile, nur eigene lesbar, schreiben nur über accept_rules
create table public.rules_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null references public.community_rules (version),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.rules_consents enable row level security;
create policy "Eigene Zustimmungen lesen" on public.rules_consents
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.rules_consents from anon, authenticated;
grant select on public.rules_consents to authenticated;

-- Aktuelle Fassung (für alle)
create function public.current_rules()
returns table (version integer, intro text, items text[], summary text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.version, r.intro, r.items, r.summary, r.published_at
  from public.community_rules r order by r.version desc limit 1;
$$;
revoke execute on function public.current_rules() from public;
grant execute on function public.current_rules() to anon, authenticated;

-- Zustimmen: nur zu einer vorhandenen Fassung; mehrfach ist kein Fehler
create function public.accept_rules(v integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.community_rules r where r.version = v) then raise exception 'not_found'; end if;
  insert into public.rules_consents (user_id, version) values (auth.uid(), v) on conflict do nothing;
end;
$$;
revoke execute on function public.accept_rules(integer) from public, anon;
grant execute on function public.accept_rules(integer) to authenticated;

-- Höchste Fassung, der das eigene Konto zugestimmt hat (0 = keiner)
create function public.my_rules_consent() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(c.version), 0) from public.rules_consents c where c.user_id = auth.uid();
$$;
revoke execute on function public.my_rules_consent() from public, anon;
grant execute on function public.my_rules_consent() to authenticated;

-- Admin: alle Fassungen mit Zahl der Zustimmungen; Konten insgesamt
create function public.mod_rules_history()
returns table (
  version integer, intro text, items text[], summary text, published_at timestamptz, publisher_name text,
  consents integer, accounts integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_moderator();
  return query
  select r.version, r.intro, r.items, r.summary, r.published_at, p.display_name,
         (select count(*)::int from public.rules_consents c where c.version = r.version),
         (select count(*)::int from public.profiles)
  from public.community_rules r left join public.profiles p on p.id = r.published_by
  order by r.version desc
  limit 50;
end;
$$;
revoke execute on function public.mod_rules_history() from public, anon;
grant execute on function public.mod_rules_history() to authenticated;

-- Neue Fassung veröffentlichen (nur Founder); liefert die neue Versionsnummer
create function public.mod_publish_rules(intro text, items text[], summary text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  clean text[];
  v integer;
begin
  perform public.require_moderator();
  if not public.is_founder() then raise exception 'founder_only'; end if;
  select coalesce(array_agg(btrim(x) order by n), '{}') into clean
    from unnest(items) with ordinality as t(x, n) where char_length(btrim(x)) > 0;
  if char_length(btrim(coalesce(intro, ''))) = 0 or cardinality(clean) = 0 then raise exception 'empty'; end if;
  if cardinality(clean) > 15 or exists (select 1 from unnest(clean) x where char_length(x) > 500)
     or char_length(btrim(intro)) > 500 then
    raise exception 'too_long';
  end if;
  if char_length(btrim(coalesce(summary, ''))) = 0 then raise exception 'no_reason'; end if;
  if char_length(btrim(summary)) > 300 then raise exception 'too_long'; end if;
  select coalesce(max(r.version), 0) + 1 into v from public.community_rules r;
  insert into public.community_rules (version, intro, items, summary, published_by)
  values (v, btrim(intro), clean, btrim(summary), auth.uid());
  perform public.mod_log('publish_rules', null, null, 'Fassung ' || v || ': ' || btrim(summary));
  return v;
end;
$$;
revoke execute on function public.mod_publish_rules(text, text[], text) from public, anon;
grant execute on function public.mod_publish_rules(text, text[], text) to authenticated;

notify pgrst, 'reload schema';
