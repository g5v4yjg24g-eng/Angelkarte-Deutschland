// Hintergrund (nur iPhone-App, angemeldet): Gerät für Mitteilungen anmelden und beim Antippen einer Mitteilung
// in den passenden Bereich springen. Rendert nichts.
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { pushTarget } from '../../domain/push';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { setupPush } from './pushDevice';

export function PushSetup() {
  const { push, account } = useProviders();
  const navigate = useNavigate();
  const userId = account.enabled ? storedUserId() : undefined;

  useEffect(() => {
    if (!push.available || !account.enabled) return;
    // Fehler (z. B. ohne Netz) sind nicht schlimm: beim nächsten Start erneut (Einstellungen zeigen den Fehler)
    if (userId) setupPush(push, account).catch(() => undefined);
    // nach dem Anmelden am Konto sofort, nicht erst beim nächsten Start
    return account.onChange((user) => {
      if (user) setupPush(push, account).catch(() => undefined);
    });
  }, [push, account, userId]);

  useEffect(() => {
    if (!push.available) return;
    return push.onTap((data) => {
      const to = pushTarget(data);
      if (to) void navigate(to);
    });
  }, [push, navigate]);

  return null;
}
