// Umschalter im Bereich „Wetter": Vorhersage und Angelkalender (zwei Adressen, ein Leistenpunkt).
import { NavLink } from 'react-router';
import { de } from '../../i18n/de';
import styles from './Weather.module.css';

export function WeatherTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    [styles.tab, isActive ? styles.tabActive : ''].join(' ');
  return (
    <nav className={styles.tabs} aria-label={de.calendar.tabsLabel}>
      <NavLink to="/wetter" end className={cls}>
        {de.calendar.tabForecast}
      </NavLink>
      <NavLink to="/wetter/kalender" className={cls}>
        {de.calendar.tabCalendar}
      </NavLink>
    </nav>
  );
}
