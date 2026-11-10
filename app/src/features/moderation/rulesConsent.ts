// Community-Regeln auf dem Gerät (Wunsch Nutzer 2026-11-03, Versionen seit 2026-11-10): zuletzt bekannte Fassung
// (eingebaut oder vom Server) und die höchste Fassung, der auf diesem Gerät zugestimmt wurde.
import { useEffect, useSyncExternalStore } from 'react';
import { de } from '../../i18n/de';
import { needsRulesConsent, RULES_VERSION } from '../../domain/moderation';
import { newerRules, parseStoredRules, storeRules, type CommunityRules } from '../../domain/communityRules';
import type { AccountProvider } from '../../ports/account';
import { storedUserId } from '../badges/badgeStore';

const KEY = 'fangpunkt.rulesAccepted';
const RULES_KEY = 'fangpunkt.rules';

/** Fassung 1, fest in der App (wortgleich mit der ersten Fassung auf dem Server) */
export const BUILTIN_RULES: CommunityRules = {
  version: RULES_VERSION,
  intro: de.moderation.rulesIntro,
  items: [...de.moderation.rules],
  publishedAt: '2026-11-03T00:00:00Z',
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let snapshot: CommunityRules | undefined;
/** Zuletzt bekannte Fassung: gespeicherte vom Server, sonst die eingebaute */
export function knownRules(): CommunityRules {
  snapshot ??= newerRules(parseStoredRules(read(RULES_KEY)), BUILTIN_RULES);
  return snapshot;
}

export function rememberRules(r: CommunityRules) {
  if (r.version < knownRules().version) return;
  try {
    localStorage.setItem(RULES_KEY, storeRules(r));
  } catch {
    // ohne Speicher gilt bis zum nächsten Abruf die bisherige Fassung
  }
  snapshot = r;
  emit();
}

/** Aktuelle Fassung vom Server holen (nur, wenn ohnehin Netz gebraucht wird); bei Fehlern die bekannte */
export async function loadCurrentRules(
  account: Pick<AccountProvider, 'currentRules'>,
): Promise<CommunityRules> {
  try {
    const r = await account.currentRules();
    if (r) rememberRules(r);
  } catch {
    // ohne Netz: bekannte Fassung
  }
  return knownRules();
}

/**
 * Bekannte Fassung für Anzeigen; mit gespeicherter Anmeldung einmal vom Server nachgeladen (ohne Anmeldung kein Netz).
 */
export function useCommunityRules(
  account: Pick<AccountProvider, 'currentRules' | 'enabled'>,
): CommunityRules {
  const rules = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    knownRules,
    knownRules,
  );
  useEffect(() => {
    if (!account.enabled || !storedUserId()) return;
    void loadCurrentRules(account);
  }, [account]);
  return rules;
}

/** höchste Fassung, der auf diesem Gerät zugestimmt wurde (undefined = keiner) */
export function acceptedVersion(): number | undefined {
  const n = Number(read(KEY));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function rulesAccepted(version: number = knownRules().version): boolean {
  return !needsRulesConsent(read(KEY), version);
}

export function acceptRules(version: number = knownRules().version) {
  try {
    if ((acceptedVersion() ?? 0) < version) localStorage.setItem(KEY, String(version));
  } catch {
    // ohne Speicher fragt die App beim nächsten Mal erneut
  }
}

/** Nur für Tests: Zwischenspeicher vergessen */
export function resetRulesCache() {
  snapshot = undefined;
}
