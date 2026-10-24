// Meldet beim Wechsel des App-Bereichs einen anonymen Aufruf (nur Bereichspfad), wenn die Zählung eingerichtet und
// in den Einstellungen nicht abgeschaltet ist. Nicht in automatisierten Tests (navigator.webdriver).
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useProviders } from '../../ports/providersContext';
import { countedPath } from '../../domain/usage';
import { useBoolSetting } from '../settings/useBoolSetting';

export function UsageTracker() {
  const { usage } = useProviders();
  const enabled = useBoolSetting('usageCount', true);
  const { pathname } = useLocation();
  const last = useRef<string>(undefined);

  useEffect(() => {
    if (!usage.enabled || enabled !== true || navigator.webdriver) return;
    const path = countedPath(pathname);
    if (path === last.current) return;
    last.current = path;
    usage.pageview(path);
  }, [usage, enabled, pathname]);

  return null;
}
