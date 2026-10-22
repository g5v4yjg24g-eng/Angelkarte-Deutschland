import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { de } from '../i18n/de';
import { BookIcon, ChartIcon, FishMark, MapIcon, MoreIcon, OfflineIcon, WeatherIcon } from '../design/icons';
import { Badge } from '../design/components/Badge';
import { useOnline } from '../lib/useOnline';
import { UpdatePrompt } from './UpdatePrompt';
import { BackupReminder } from '../features/backup/BackupReminder';
import { SessionChip } from '../features/sessions/SessionChip';
import { WeatherSync } from '../features/weather/WeatherSync';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/', label: de.nav.map, icon: MapIcon, end: true },
  { to: '/fangbuch', label: de.nav.catches, icon: BookIcon, end: false },
  { to: '/wetter', label: de.nav.weather, icon: WeatherIcon, end: false },
  { to: '/statistik', label: de.nav.stats, icon: ChartIcon, end: false },
  { to: '/mehr', label: de.nav.more, icon: MoreIcon, end: false },
] as const;

declare global {
  interface Window {
    __fangpunktAppReady?: () => void;
  }
}

export function AppShell() {
  const online = useOnline();
  useEffect(() => {
    // Intro ausblenden, sobald die Oberfläche steht (index.html).
    window.__fangpunktAppReady?.();
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <FishMark size={30} />
          <span className={styles.wordmark}>{de.app.name}</span>
        </span>
        <span className={styles.headerEnd}>
          <SessionChip />
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
      <nav className={styles.nav} aria-label={de.nav.label}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
          >
            <span className={styles.navIcon}>
              <Icon />
            </span>
            <span className={styles.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={styles.main} id="main">
        <BackupReminder />
        <Outlet />
      </main>
      <UpdatePrompt />
      <WeatherSync />
    </div>
  );
}
