// Zustimmung zu den Regeln der Community – auf dem Gerät gemerkt (Wunsch Nutzer 2026-11-03).
import { needsRulesConsent, RULES_VERSION } from '../../domain/moderation';

const KEY = 'fangpunkt.rulesAccepted';

export function rulesAccepted(): boolean {
  try {
    return !needsRulesConsent(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function acceptRules() {
  try {
    localStorage.setItem(KEY, String(RULES_VERSION));
  } catch {
    // ohne Speicher fragt die App beim nächsten Mal erneut
  }
}
