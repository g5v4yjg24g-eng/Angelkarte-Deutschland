// Konto vorerst nicht freigeschaltet (Entscheidung Nutzer 2026-10-26): Der Standard-Mailversand von Supabase
// erreicht echte Postfächer nicht zuverlässig (nur Team-Adressen, Stundenlimit, Firmenfilter verbrauchen den Link).
// Bis ein eigener Mailversand steht, zeigt Mehr → Konto „Demnächst“. Zum Ausprobieren und in E2E:
// localStorage['fangpunkt.preview.account'] = '1'.
export const ACCOUNT_PREVIEW_KEY = 'fangpunkt.preview.account';

export function accountOpen(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}
