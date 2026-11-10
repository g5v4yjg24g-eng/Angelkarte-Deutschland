// Profil teilen (Wunsch Nutzer 2026-11-10): Link auf fangpunkt.com/profil/?u=<Nutzername>. Mit der iPhone-App
// öffnet er dank Universal Links direkt das Profil in der App, sonst eine Seite der Website mit Weg zur Web-App.
// Im Link steht nur der Nutzername (öffentlich wie in der Suche), nie eine ID oder ein Ort. Rein.
import { USERNAME_RE } from './account';

export const PROFILE_LINK_BASE = 'https://fangpunkt.com/profil/';
/** Öffentliche Adresse der Web-App (GitHub Pages) – Ziel der Links aus Bestätigungs- und Passwort-Mails */
export const WEB_APP_URL = 'https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/';
const HOSTS = new Set(['fangpunkt.com', 'www.fangpunkt.com']);

export function profileLink(username: string): string {
  return `${PROFILE_LINK_BASE}?u=${encodeURIComponent(username)}`;
}

/** Ziel in der App für einen geöffneten Link; undefined = kein Profil-Link (dann nichts tun) */
export function profileLinkTarget(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)) return undefined;
  if (url.pathname !== '/profil/' && url.pathname !== '/profil') return undefined;
  const u = (url.searchParams.get('u') ?? '').trim().toLowerCase();
  return USERNAME_RE.test(u) ? `/profil/nutzer/${u}` : undefined;
}
