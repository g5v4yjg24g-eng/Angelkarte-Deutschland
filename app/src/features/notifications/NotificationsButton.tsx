// Kleiner Fisch (nur Umriss) rechts oben im Feed; die Zahl der Ungelesenen steht daran, ab 10 als „9+“.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { FishOutlineIcon } from '../../design/icons';
import { badgeLabel } from '../../domain/notifications';
import { useProviders } from '../../ports/providersContext';
import { useUnreadNotifications } from './unreadStore';
import styles from './Notifications.module.css';

export const NOTIFICATIONS_PATH = '/feed/mitteilungen';

export function NotificationsButton() {
  const { account } = useProviders();
  const unread = useUnreadNotifications(account, true);
  const label = badgeLabel(unread);
  return (
    <Link to={NOTIFICATIONS_PATH} className={styles.fishButton} aria-label={de.notifications.button(unread)}>
      <FishOutlineIcon size={26} />
      {label && (
        <span className={styles.count} aria-hidden="true">
          {label}
        </span>
      )}
    </Link>
  );
}
