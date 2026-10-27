// Anonyme Nutzungszählung (Entscheidung Nutzer 2026-10-24: GoatCounter). Gezählt wird nur, welcher Bereich der App
// aufgerufen wurde – nie IDs von Fängen oder Sessions, keine Abfragen, keine Titel. Unbekannte Pfade → „/sonstige“.

const STATIC = new Set([
  '/',
  '/fangbuch',
  '/fangbuch/sessions',
  '/wetter',
  '/wetter/kalender',
  '/statistik',
  '/profil',
  '/profil/bearbeiten',
  '/profil/neu',
  '/mehr',
  '/mehr/einstellungen',
  '/mehr/koeder',
  '/mehr/info',
  '/mehr/datenschutz',
  '/mehr/daten',
  '/mehr/recht',
]);
const STATE = /^\/mehr\/recht\/[A-Z]{2}$/;

/** Pfad ohne Basis (z. B. „/Angelkarte-Deutschland“) → zählbarer Bereich ohne persönliche Angaben. */
export function countedPath(pathname: string, base = '/'): string {
  const b = base.replace(/\/$/, '');
  let p = b && pathname.startsWith(b) ? pathname.slice(b.length) : pathname;
  p = p.replace(/\/+$/, '') || '/';
  if (STATIC.has(p)) return p;
  if (STATE.test(p)) return p;
  if (/^\/fangbuch\/sessions\/[^/]+\/rueckblick$/.test(p)) return '/fangbuch/sessions/:id/rueckblick';
  if (/^\/fangbuch\/sessions\/[^/]+$/.test(p)) return '/fangbuch/sessions/:id';
  if (/^\/fangbuch\/[^/]+$/.test(p)) return '/fangbuch/:id';
  if (/^\/profil\/beitrag\/[^/]+$/.test(p)) return '/profil/beitrag/:id';
  return '/sonstige';
}

/** GoatCounter-Code (Teil der Adresse <code>.goatcounter.com) – nur Kleinbuchstaben, Ziffern, Bindestrich. */
export const validCounterCode = (code: string | undefined): code is string =>
  !!code && /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(code);
