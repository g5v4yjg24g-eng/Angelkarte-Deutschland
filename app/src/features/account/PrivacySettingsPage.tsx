// Mehr → Konto → Privatsphäre (Wunsch Nutzer 2026-11-11): die Einstellungen, die bestimmen, wer was von dir sieht,
// an einem Ort – „Privates Konto“ und „Wer sieht deine Erfolge?“. Beides speichert sofort auf dem Server.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { useProviders } from '../../ports/providersContext';
import { AchievementVisibility } from '../achievements/AchievementVisibility';
import { storedUserId } from '../badges/badgeStore';
import { PrivateAccountSwitch } from '../friends/PrivateAccountSwitch';
import { SuggestionSettings } from '../suggestions/SuggestionSettings';

const t = de.account;

export function PrivacySettingsPage() {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  return (
    <Page title={t.privacyTitle} back="/mehr/konto">
      {signedIn ? (
        <>
          <PrivateAccountSwitch title={t.privacyFollowTitle} />
          <AchievementVisibility />
          <SuggestionSettings />
        </>
      ) : (
        <Notice>
          {t.privacySignedOut} <Link to="/mehr/konto">{t.privacyToAccount}</Link>
        </Notice>
      )}
    </Page>
  );
}
