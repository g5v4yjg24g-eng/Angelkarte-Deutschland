-- Fangpunkt – Sicherheitsprüfung Phase 5 (2026-11-06): die letzten beiden Funktionen, die Supabase per Vorgabe für
-- alle freigibt, ohne dass die App sie braucht. Harmlos (Trigger-Funktion bzw. feste Adresse), aber nur noch für
-- den Server selbst. Nur Rechte entzogen; nichts wird gelöscht. Trigger laufen weiter (beim Auslösen wird kein
-- Ausführungsrecht geprüft), enqueue_push läuft als Eigentümer.
revoke execute on function public.profiles_touch() from public, anon, authenticated;
revoke execute on function public.push_function_url() from public, anon, authenticated;
