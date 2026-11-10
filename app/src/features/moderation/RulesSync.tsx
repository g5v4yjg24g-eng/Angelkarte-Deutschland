// Neue Fassung der Community-Regeln (Wunsch Nutzer 2026-11-10): einmal pro App-Start, nur mit gespeicherter
// Anmeldung. Hat das Konto der aktuellen Fassung noch nicht zugestimmt, erscheint das Fenster mit der Änderung;
// „Später“ fragt beim nächsten Start erneut. Wer auf diesem Gerät schon zugestimmt hat (z. B. beim Registrieren),
// wird still auf dem Server nachgetragen.
import { useEffect, useState } from 'react';
import type { CommunityRules } from '../../domain/communityRules';
import { needsConsentFor } from '../../domain/communityRules';
import { useProviders } from '../../ports/providersContext';
import { useStoredUserId } from '../badges/badgeStore';
import { RulesConsent } from './Rules';
import { acceptedVersion, acceptRules, loadCurrentRules } from './rulesConsent';

let checkedFor: string | undefined;

export function RulesSync() {
  const { account } = useProviders();
  const userId = useStoredUserId();
  const [ask, setAsk] = useState<CommunityRules>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account.enabled || !userId || checkedFor === userId) return;
    checkedFor = userId;
    let live = true;
    void (async () => {
      try {
        const rules = await loadCurrentRules(account);
        const server = await account.myRulesConsent();
        if (!needsConsentFor(server, rules.version)) {
          acceptRules(server);
          return;
        }
        if (!needsConsentFor(acceptedVersion(), rules.version)) {
          await account.acceptRules(rules.version);
          return;
        }
        if (live) setAsk(rules);
      } catch {
        // ohne Netz oder ohne Server-Funktion: beim nächsten Start erneut
        checkedFor = undefined;
      }
    })();
    return () => {
      live = false;
    };
  }, [account, userId]);

  if (!ask) return null;
  return (
    <RulesConsent
      open
      update
      rules={ask}
      busy={busy}
      onAccept={() => {
        setBusy(true);
        void account
          .acceptRules(ask.version)
          .then(() => {
            acceptRules(ask.version);
            setAsk(undefined);
          })
          .catch(() => setAsk(undefined))
          .finally(() => setBusy(false));
      }}
      onDecline={() => setAsk(undefined)}
    />
  );
}
