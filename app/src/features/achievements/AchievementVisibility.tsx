// „Wer sieht deine Erfolge?“ (Paket B, Entscheidung Nutzer 2026-11-10: selbst wählbar, Standard Freunde).
// Nur mit Konto; gespeichert wird sofort auf dem Server, bei Fehler springt die Auswahl zurück.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { ACH_VISIBILITIES, type AchVisibility } from '../../domain/sharedAchievements';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

const t = de.achievements.share;

export function AchievementVisibility() {
  const { account } = useProviders();
  const online = useOnline();
  const signedIn = account.enabled && !!storedUserId();
  const [value, setValue] = useState<AchVisibility>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!signedIn || !online) return;
    let live = true;
    account
      .myAchievementsVisibility()
      .then((v) => live && setValue(v))
      .catch(() => live && setError(t.loadError));
    return () => {
      live = false;
    };
  }, [account, signedIn, online]);

  if (!signedIn) return null;
  const change = async (v: AchVisibility) => {
    const before = value;
    setValue(v);
    setError(undefined);
    setSaved(false);
    try {
      await account.setMyAchievementsVisibility(v);
      setSaved(true);
    } catch {
      setValue(before);
      setError(t.saveError);
    }
  };

  return (
    <Section title={t.title}>
      {value ? (
        <SegmentedControl
          label={t.title}
          options={ACH_VISIBILITIES.map((v) => ({ value: v, label: t.options[v] }))}
          value={value}
          onChange={(v) => void change(v)}
        />
      ) : (
        !error && <p className="muted">{online ? de.achievements.loading : t.offline}</p>
      )}
      <p className="muted">
        {value ? t.hints[value] : null} {t.what}
      </p>
      <p role="status" className="visually-hidden">
        {saved ? t.saved : ''}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}
