// Admin → Verwaltung → Systemnachrichten: die Hinweis-Mail „Anmeldung mit Passwort“ (vorher unten in der
// Meldungsliste). Test-Mail, Versandprotokoll und weitere Nachrichten folgen in Phase 5.
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { ADMIN_BASE } from './adminPaths';
import { PasswordNotice } from './PasswordNotice';

export function SystemMessagesPage() {
  return (
    <Page title={de.modAdmin.settings.messages} back={`${ADMIN_BASE}/verwaltung`}>
      <PasswordNotice />
    </Page>
  );
}
