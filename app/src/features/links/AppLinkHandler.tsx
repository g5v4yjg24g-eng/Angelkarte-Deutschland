// Öffnet geteilte Profil-Links (fangpunkt.com/profil/?u=…) in der iPhone-App direkt auf der Profilseite.
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { profileLinkTarget } from '../../domain/profileLink';
import { useProviders } from '../../ports/providersContext';

export function AppLinkHandler() {
  const { links } = useProviders();
  const navigate = useNavigate();
  useEffect(() => {
    if (!links) return;
    let live = true;
    const go = (url: string | undefined) => {
      const to = url ? profileLinkTarget(url) : undefined;
      if (live && to) void navigate(to);
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
