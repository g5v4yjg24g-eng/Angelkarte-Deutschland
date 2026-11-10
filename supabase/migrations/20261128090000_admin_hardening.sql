-- Fangpunkt – Admin-Bereich, Qualitätssicherung (2026-11-10): zwei interne Hilfsfunktionen waren (wie jede neue
-- Funktion standardmäßig) für alle aufrufbar. Sie lesen keine Daten (nur Hash bzw. Schreibweise eines Namens),
-- werden aber nur innerhalb anderer Server-Funktionen gebraucht – deshalb zugesperrt. Ändert sonst nichts.
revoke execute on function public.appeal_hash(text) from public, anon, authenticated;
revoke execute on function public.username_key(text) from public, anon, authenticated;
