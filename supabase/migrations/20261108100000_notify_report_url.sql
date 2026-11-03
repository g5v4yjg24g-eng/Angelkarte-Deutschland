-- Fangpunkt – Adresse der Edge Function für Meldungen. Im Dashboard angelegt: angezeigter Name „notify-report“,
-- Adresse (Slug) aber „hyper-function“ (Vorschlag des Editors, nachträglich nicht änderbar). Code: supabase/functions/notify-report.
create or replace function public.notify_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
    body := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;
revoke execute on function public.notify_report() from public, anon, authenticated;

-- schon gespeicherte Meldungen ohne Mail jetzt nachholen
select net.http_post(
  url := 'https://sgnyymciwnwjgvojptwu.supabase.co/functions/v1/hyper-function',
  body := jsonb_build_object('record', jsonb_build_object('id', r.id)),
  headers := '{"Content-Type": "application/json"}'::jsonb
)
from public.reports r
where r.notified_at is null;
