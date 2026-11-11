// Mehr: in Gruppen geordnet (Wunsch Nutzer 2026-11-06, „weniger unübersichtlich, nicht mehr Ebenen“).
// Moderation steht nur für Moderatoren oben.
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import {
  CalendarIcon,
  DatabaseIcon,
  FeedIcon,
  HookIcon,
  InfoIcon,
  KnotIcon,
  LockIcon,
  ParagraphIcon,
  ShieldIcon,
  SlidersIcon,
  UserIcon,
} from '../../design/icons';
import { ACCOUNT_STORAGE_KEY } from '../../ports/account';
import { useIsModerator } from '../moderation/admin/useIsModerator';
import styles from '../../design/components/Page.module.css';

const t = de.more;

/** Nur prüfen, ob eine Anmeldung gespeichert ist – ohne den Konto-Anbieter zu laden */
function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(ACCOUNT_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function MorePage() {
  const moderator = useIsModerator();
  return (
    <Page title={t.title}>
      {moderator && (
        <div className={styles.card}>
          <ListLink
            to="/moderation"
            icon={<ShieldIcon />}
            title={de.modAdmin.title}
            hint={de.modAdmin.moreHint}
          />
        </div>
      )}
      <Section title={t.groupPlan}>
        <div className={styles.card}>
          <ListLink to="/wetter/kalender" icon={<CalendarIcon />} title={t.calendar} />
          <ListLink to="/mehr/knoten" icon={<KnotIcon />} title={t.knots} />
          <ListLink to="/mehr/koeder" icon={<HookIcon />} title={t.baits} />
        </div>
      </Section>
      <Section title={t.groupRules}>
        <div className={styles.card}>
          <ListLink to="/mehr/recht" icon={<ParagraphIcon />} title={t.regulations} />
          <ListLink to="/mehr/regeln" icon={<FeedIcon />} title={t.communityRules} />
        </div>
      </Section>
      <Section title={t.groupAccount}>
        <div className={styles.card}>
          <ListLink
            to="/mehr/konto"
            icon={<UserIcon />}
            title={t.account}
            {...(hasStoredSession() ? { hint: t.accountHintSignedIn } : {})}
          />
          <ListLink to="/mehr/daten" icon={<DatabaseIcon />} title={t.backup} />
        </div>
      </Section>
      <Section title={t.groupApp}>
        <div className={styles.card}>
          <ListLink to="/mehr/einstellungen" icon={<SlidersIcon />} title={t.settings} />
          <ListLink to="/mehr/datenschutz" icon={<LockIcon />} title={t.privacy} />
          <ListLink to="/mehr/info" icon={<InfoIcon />} title={t.about} />
        </div>
      </Section>
    </Page>
  );
}
