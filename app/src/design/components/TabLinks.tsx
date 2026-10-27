// Umschalter zwischen zusammengehörigen Seiten (z. B. Fangbuch | Statistik, Knoten | Montagen)
import { NavLink } from 'react-router';
import styles from './TabLinks.module.css';

export function TabLinks({ label, tabs }: { label: string; tabs: readonly { to: string; label: string }[] }) {
  return (
    <nav
      className={styles.tabs}
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={styles.tab ?? ''}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
