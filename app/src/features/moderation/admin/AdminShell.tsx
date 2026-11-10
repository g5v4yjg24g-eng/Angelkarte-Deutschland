// Admin-Bereich (Phase 1, Wunsch Nutzer 2026-11-10): eigener Rahmen mit derselben unteren Leiste wie die App, aber den
// vier Punkten Übersicht · Meldungen · Nutzer · Verwaltung. Die normale Leiste ist hier nie zu sehen. „Zur App“ oben
// links führt zurück, ohne abzumelden. Sichtbar nur für Moderatoren – entschieden wird aber auf dem Server: Jede
// Funktion dahinter prüft is_moderator() selbst (direkte Adressen oder Anfragen helfen Nicht-Moderatoren nicht).
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { de } from '../../../i18n/de';
import {
  ChevronLeftIcon,
  DashboardIcon,
  FeedIcon,
  FlagIcon,
  GearIcon,
  ShieldIcon,
} from '../../../design/icons';
import { Notice } from '../../../design/components/Notice';
import { Page } from '../../../design/components/Page';
import { BottomNav, type NavItem } from '../../../app/BottomNav';
import { ShellHeader } from '../../../app/AppShell';
import { useProviders } from '../../../ports/providersContext';
import { useIsModerator } from './useIsModerator';
import shell from '../../../app/AppShell.module.css';

const t = de.modAdmin;
import { ADMIN_BASE } from './adminPaths';

/** Offene Meldungen für die Zahl an „Meldungen“ – neu bei jedem Seitenwechsel im Admin-Bereich */
function useOpenReports(enabled: boolean): number | undefined {
  const { account } = useProviders();
  const { pathname } = useLocation();
  const [count, setCount] = useState<number>();
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    account
      .modOverview()
      .then((o) => live && setCount(o.openReports))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [account, enabled, pathname]);
  return count;
}

export function AdminShell() {
  const moderator = useIsModerator();
  const open = useOpenReports(moderator === true);
  const nav: readonly NavItem[] = [
    { to: ADMIN_BASE, label: t.nav.overview, icon: DashboardIcon, end: true },
    {
      to: `${ADMIN_BASE}/meldungen`,
      label: t.nav.reports,
      icon: FlagIcon,
      end: false,
      ...(open ? { badge: <span aria-label={t.openBadge(open)}>{open > 99 ? '99+' : open}</span> } : {}),
    },
    { to: `${ADMIN_BASE}/nutzer`, label: t.nav.users, icon: FeedIcon, end: false },
    { to: `${ADMIN_BASE}/verwaltung`, label: t.nav.settings, icon: GearIcon, end: false },
  ];
  return (
    <div className={shell.shell}>
      <ShellHeader
        start={
          <Link to="/mehr" className={shell.backToApp} aria-label={t.backToAppLabel}>
            <ChevronLeftIcon size={22} />
            {t.backToApp}
          </Link>
        }
        end={
          <span className={shell.adminBadge}>
            <ShieldIcon size={16} />
            {t.title}
          </span>
        }
      />
      {moderator === true && <BottomNav items={nav} label={t.nav.label} />}
      <main className={shell.main} id="main">
        {moderator === true ? (
          <Outlet />
        ) : (
          <Page title={t.title}>
            {moderator === false ? <Notice>{t.notModerator}</Notice> : <p className="muted">{t.loading}</p>}
          </Page>
        )}
      </main>
    </div>
  );
}
