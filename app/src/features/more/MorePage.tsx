import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import { DatabaseIcon, HookIcon, InfoIcon, ParagraphIcon, SlidersIcon } from '../../design/icons';
import styles from '../../design/components/Page.module.css';

export function MorePage() {
  return (
    <Page title={de.more.title}>
      <div className={styles.card}>
        <ListLink
          to="/mehr/recht"
          icon={<ParagraphIcon />}
          title={de.more.regulations}
          hint={de.more.regulationsHint}
        />
        <ListLink to="/mehr/koeder" icon={<HookIcon />} title={de.more.baits} hint={de.more.baitsHint} />
        <ListLink to="/mehr/daten" icon={<DatabaseIcon />} title={de.more.backup} hint={de.more.backupHint} />
      </div>
      <div className={styles.card}>
        <ListLink
          to="/mehr/einstellungen"
          icon={<SlidersIcon />}
          title={de.more.settings}
          hint={de.more.settingsHint}
        />
        <ListLink to="/mehr/info" icon={<InfoIcon />} title={de.more.about} hint={de.more.aboutHint} />
      </div>
    </Page>
  );
}
