// Admin → Verwaltung: Werkzeuge. Was erst später kommt (Einsprüche), steht als „folgt“ (nicht antippbar).
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { ListLink } from '../../../design/components/ListLink';
import {
  ChartIcon,
  ExitIcon,
  FeedIcon,
  LockIcon,
  MailIcon,
  ParagraphIcon,
  ShieldIcon,
  UserIcon,
} from '../../../design/icons';
import { ADMIN_BASE } from './adminPaths';
import pageStyles from '../../../design/components/Page.module.css';

const t = de.modAdmin.settings;

export function AdminSettingsPage() {
  return (
    <Page title={t.title}>
      <Section title={t.tools}>
        <div className={pageStyles.card}>
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/nachrichten`}
            icon={<MailIcon />}
            title={t.messages}
            hint={t.messagesHint}
          />
          <ListLink to="/mehr/regeln" icon={<ParagraphIcon />} title={t.rules} hint={t.rulesHint} />
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/namen`}
            icon={<LockIcon />}
            title={t.names}
            hint={t.namesHint}
          />
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/protokoll`}
            icon={<ShieldIcon />}
            title={t.log}
            hint={t.logHint}
          />
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/statistik`}
            icon={<ChartIcon />}
            title={t.stats}
            hint={t.statsHint}
          />
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/rollen`}
            icon={<UserIcon />}
            title={t.roles}
            hint={t.rolesHint}
          />
          <ListLink icon={<FeedIcon />} title={t.appeals} hint={t.soon} />
        </div>
      </Section>
      <div className={pageStyles.card}>
        <ListLink to="/mehr" icon={<ExitIcon />} title={t.leave} />
      </div>
    </Page>
  );
}
