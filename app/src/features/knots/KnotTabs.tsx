// Umschalter Knoten | Montagen (Mehr → Knoten & Montagen)
import { NavLink } from 'react-router';
import { de } from '../../i18n/de';
import styles from './Rigs.module.css';

export function KnotTabs() {
  return (
    <nav className={styles.tabs} aria-label={de.more.knots}>
      <NavLink to="/mehr/knoten" end className={styles.tab ?? ''}>
        {de.knots.title}
      </NavLink>
      <NavLink to="/mehr/montagen" end className={styles.tab ?? ''}>
        {de.rigs.title}
      </NavLink>
    </nav>
  );
}
