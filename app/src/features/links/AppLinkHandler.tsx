// Öffnet Links in der iPhone-App: geteilte Profile (fangpunkt.com/profil/?u=…) direkt auf der Profilseite und die Knöpfe
// der Live Activity (fangpunkt://session/…).
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { liveLinkAction } from '../../domain/liveLink';
import { profileLinkTarget } from '../../domain/profileLink';
import { runLiveAction } from '../sessions/liveActivity/liveLinks';
import { useProviders } from '../../ports/providersContext';

export function AppLinkHandler() {
  const { links } = useProviders();
  const navigate = useNavigate();
  useEffect(() => {
    if (!links) return;
    let live = true;
    const go = (url: string | undefined) => {
      if (!url || !live) return;
      // Knöpfe der Live Activity (fangpunkt://session/…)
      const action = liveLinkAction(url);
      if (action) {
        void runLiveAction(action, (to, options) => navigate(to, options)).catch(() => undefined);
        return;
      }
      const to = profileLinkTarget(url);
      if (to) void navigate(to);
    };
    void links.launchUrl().then(go);
    const off = links.onOpen(go);
    return () => {
      live = false;
      off();
    };
  }, [links, navigate]);
  return null;
}
