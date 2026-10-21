import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { applyTheme, readTheme, type ThemeChoice } from '../../lib/theme';

const OPTIONS = [
  { value: 'system', label: de.settings.themeSystem },
  { value: 'light', label: de.settings.themeLight },
  { value: 'dark', label: de.settings.themeDark },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>(() => readTheme());
  return (
    <Page title={de.settings.title} back="/mehr">
      <Section title={de.settings.theme}>
        <SegmentedControl
          label={de.settings.theme}
          options={OPTIONS}
          value={theme}
          onChange={(v) => {
            setTheme(v);
            applyTheme(v);
          }}
        />
        <p className="muted">{de.settings.themeHint}</p>
      </Section>
    </Page>
  );
}
