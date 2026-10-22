import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { applyTheme, readTheme, type ThemeChoice } from '../../lib/theme';
import { setSetting } from '../../data/settings';
import { useWeatherEnabled } from '../weather/useWeatherEnabled';
import { useBoolSetting } from './useBoolSetting';

const OPTIONS = [
  { value: 'system', label: de.settings.themeSystem },
  { value: 'light', label: de.settings.themeLight },
  { value: 'dark', label: de.settings.themeDark },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

const LOCATION_OPTIONS = [
  { value: 'off', label: de.settings.locationOff },
  { value: 'on', label: de.settings.locationOn },
] as const;

const WEATHER_OPTIONS = [
  { value: 'off', label: de.settings.weatherOff },
  { value: 'on', label: de.settings.weatherOn },
] as const;

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>(() => readTheme());
  const weather = useWeatherEnabled();
  const locateOnStart = useBoolSetting('locateOnStart', true);
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
      <Section title={de.settings.location}>
        {locateOnStart !== undefined && (
          <SegmentedControl
            label={de.settings.location}
            options={LOCATION_OPTIONS}
            value={locateOnStart ? 'on' : 'off'}
            onChange={(v) => void setSetting('locateOnStart', v === 'on')}
          />
        )}
        <p className="muted">{de.settings.locationHint}</p>
      </Section>
      <Section title={de.settings.weather}>
        {weather !== undefined && (
          <SegmentedControl
            label={de.settings.weather}
            options={WEATHER_OPTIONS}
            value={weather ? 'on' : 'off'}
            onChange={(v) => void setSetting('weatherEnabled', v === 'on')}
          />
        )}
        <p className="muted">{de.settings.weatherHint}</p>
      </Section>
    </Page>
  );
}
