import { useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { de } from '../i18n/de';
import { BookIcon, FeedIcon, FishMark, MapIcon, MoreIcon, OfflineIcon, WeatherIcon } from '../design/icons';
import { Badge } from '../design/components/Badge';
import { useOnline } from '../lib/useOnline';
import { UpdatePrompt } from './UpdatePrompt';
import { BackupReminder } from '../features/backup/BackupReminder';
import { SessionChip } from '../features/sessions/SessionChip';
import { WeatherSync } from '../features/weather/WeatherSync';
import { PostSync } from '../features/sharing/PostSync';
import { AvatarSync } from '../features/profile/AvatarSync';
import { ProfileExtrasSync } from '../features/profile/ProfileExtrasSync';
import { AppLinkHandler } from '../features/links/AppLinkHandler';
import { AchievementSync } from '../features/achievements/AchievementSync';
import { AchievementUpload } from '../features/achievements/AchievementUpload';
import { SpotSync } from '../features/spots/SpotSync';
import { PushSetup } from '../features/push/PushSetup';
import { WhatsNew } from '../features/whatsNew/WhatsNew';
import { UsageTracker } from '../features/usage/UsageTracker';
import { AuthRedirect } from '../features/account/AuthRedirect';
import { SessionTracker } from '../features/sessions/tracking/SessionTracker';
import { GaugeSync } from '../features/weather/GaugeSync';
import { RulesSync } from '../features/moderation/RulesSync';
import { TripStartHost } from '../features/trips/TripStartHost';
import { ProfileNavIcon } from '../features/profile/ProfileNavIcon';
import { BottomNav, type NavItem } from './BottomNav';
import { useProviders } from '../ports/providersContext';
import { useStoredUserId } from '../features/badges/badgeStore';
import { useUnreadNotifications } from '../features/notifications/unreadStore';
import styles from './AppShell.module.css';

// Sechs Punkte, Profil in der Mitte (Entscheidung Nutzer 2026-10-27); die Statistik ist ein Reiter im Fangbuch.
const NAV: readonly NavItem[] = [
  { to: '/', label: de.nav.map, icon: MapIcon, end: true },
  { to: '/fangbuch', label: de.nav.catches, icon: BookIcon, end: false, also: '/statistik' },
  { to: '/feed', label: de.nav.feed, icon: FeedIcon, end: false },
  { to: '/profil', label: de.nav.profile, icon: ProfileNavIcon, end: false },
  { to: '/wetter', label: de.nav.weather, icon: WeatherIcon, end: false },
  { to: '/mehr', label: de.nav.more, icon: MoreIcon, end: false },
];

declare global {
  interface Window {
    __fangpunktAppReady?: () => void;
    /** alle Seiten im Hintergrund nachgeladen (Test-Signal, siehe app/router.tsx) */
    __fangpunktPagesLoaded?: boolean;
  }
}

/**
 * Gemeinsame Wurzel für die normale App und den Admin-Bereich: alles, was im Hintergrund läuft, bleibt beim Wechsel
 * zwischen beiden bestehen (Abgleich, Mitteilungen, Route, Wetter …).
 */
export function RootLayout() {
  useEffect(() => {
    // Intro ausblenden, sobald die Oberfläche steht (index.html).
    window.__fangpunktAppReady?.();
  }, []);
  return (
    <>
      <Outlet />
      <UpdatePrompt />
      <WeatherSync />
      <PostSync />
      <AvatarSync />
      <ProfileExtrasSync />
      <AppLinkHandler />
      <AchievementSync />
      <AchievementUpload />
      <SpotSync />
      <PushSetup />
      <WhatsNew />
      <UsageTracker />
      <AuthRedirect />
      <SessionTracker />
      <GaugeSync />
      <RulesSync />
      <TripStartHost />
    </>
  );
}

/** Kopfzeile mit Offline-Hinweis; `start` ersetzt das Markenzeichen (Admin-Bereich: „Zur App“) */
export function ShellHeader({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  const online = useOnline();
  return (
    <header className={styles.header}>
      {start ?? (
        <span className={styles.brand}>
          <FishMark size={30} />
          <span className={styles.wordmark}>{de.app.name}</span>
        </span>
      )}
      <span className={styles.headerEnd}>
        {end}
        {!online && (
          <span title={de.status.offlineHint}>
            <Badge tone="warning">
              <OfflineIcon size={14} />
              <span className={styles.offlineText}>{de.status.offline}</span>
            </Badge>
          </span>
        )}
      </span>
    </header>
  );
}

export function AppShell() {
  const { account } = useProviders();
  const userId = useStoredUserId();
  const unread = useUnreadNotifications(account, account.enabled && !!userId);
  const items = unread > 0 ? NAV.map((n) => (n.to === '/feed' ? { ...n, dot: de.notifications.navDot } : n)) : NAV;
  return (
    <div className={styles.shell}>
      <ShellHeader end={<SessionChip />} />
      <BottomNav items={items} label={de.nav.label} />
      <main className={styles.main} id="main">
        <BackupReminder />
        <Outlet />
      </main>
    </div>
  );
}
