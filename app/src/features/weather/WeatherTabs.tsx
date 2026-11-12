// Umschalter im Bereich „Wetter": Vorhersage und Angelkalender (zwei Adressen, ein Leistenpunkt).
import { NavLink } from 'react-router';
import { de } from '../../i18n/de';
import { CalendarIcon, WeatherIcon } from '../../design/icons';
import styles from './Weather.module.css';

export function WeatherTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    [styles.tab, isActive ? styles.tabActive : ''].join(' ');
  return (
    <nav className={styles.tabs} aria-label={de.calendar.tabsLabel}>
      <NavLink to="/wetter" end className={cls}>
        <WeatherIcon size={24} />
        {de.calendar.tabForecast}
      </NavLink>
      <NavLink to="/wetter/kalender" className={cls}>
        <CalendarIcon size={24} />
        {de.calendar.tabCalendar}
      </NavLink>
    </nav>
  );
}
