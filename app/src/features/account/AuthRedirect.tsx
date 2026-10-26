// Übergangslösung (Entscheidung Nutzer 2026-10-25): Der Anmelde-Link aus der Standard-Mail von Supabase führt auf
// die Startseite. Liegt dort eine Anmeldung (oder ein Fehler) im #-Teil der Adresse, geht es zur Kontoseite –
// mitsamt #-Teil, den dort der Supabase-Client übernimmt.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { authLinkInHash } from '../../domain/account';

export function AuthRedirect() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (pathname !== '/mehr/konto' && authLinkInHash(hash)) navigate(`/mehr/konto${hash}`, { replace: true });
  }, [pathname, hash, navigate]);
  return null;
}
