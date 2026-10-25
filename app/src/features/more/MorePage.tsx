import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import {
  DatabaseIcon,
  HookIcon,
  InfoIcon,
  KnotIcon,
  LockIcon,
  ParagraphIcon,
  SlidersIcon,
  UserIcon,
} from '../../design/icons';
import { ACCOUNT_STORAGE_KEY } from '../../ports/account';
import styles from '../../design/components/Page.module.css';

/** Nur prüfen, ob eine Anmeldung gespeichert ist – ohne den Konto-Anbieter zu laden */
function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(ACCOUNT_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function MorePage() {
  return (
    <Page title={de.more.title}>
      <div className={styles.card}>
        <ListLink
          to="/mehr/konto"
          icon={<UserIcon />}
          title={de.more.account}
          hint={hasStoredSession() ? de.more.accountHintSignedIn : de.more.accountHint}
        />
      </div>
      <div className={styles.card}>
        <ListLink
          to="/mehr/recht"
          icon={<ParagraphIcon />}
          title={de.more.regulations}
          hint={de.more.regulationsHint}
        />
        <ListLink to="/mehr/koeder" icon={<HookIcon />} title={de.more.baits} hint={de.more.baitsHint} />
        <ListLink to="/mehr/knoten" icon={<KnotIcon />} title={de.more.knots} hint={de.more.knotsHint} />
        <ListLink to="/mehr/daten" icon={<DatabaseIcon />} title={de.more.backup} hint={de.more.backupHint} />
      </div>
      <div className={styles.card}>
        <ListLink
          to="/mehr/einstellungen"
          icon={<SlidersIcon />}
          title={de.more.settings}
          hint={de.more.settingsHint}
        />
        <ListLink
          to="/mehr/datenschutz"
          icon={<LockIcon />}
          title={de.more.privacy}
          hint={de.more.privacyHint}
        />
        <ListLink to="/mehr/info" icon={<InfoIcon />} title={de.more.about} hint={de.more.aboutHint} />
      </div>
    </Page>
  );
}
