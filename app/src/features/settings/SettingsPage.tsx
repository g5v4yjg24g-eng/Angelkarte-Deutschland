import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { applyTheme, readTheme, type ThemeChoice } from '../../lib/theme';
import { setSetting } from '../../data/settings';
import { useWeatherEnabled } from '../weather/useWeatherEnabled';
import { useBoolSetting } from './useBoolSetting';
import { SyncStatusSection } from '../sharing/SyncStatus';
import { PushSettings } from '../push/PushSettings';
import { useProviders } from '../../ports/providersContext';

const OPTIONS = [
  { value: 'system', label: de.settings.themeSystem },
  { value: 'light', label: de.settings.themeLight },
  { value: 'dark', label: de.settings.themeDark },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

const LOCATION_OPTIONS = [
  { value: 'off', label: de.settings.locationOff },
  { value: 'on', label: de.settings.locationOn },
] as const;

const USAGE_OPTIONS = [
  { value: 'off', label: de.settings.usageOff },
  { value: 'on', label: de.settings.usageOn },
] as const;

const TRACKING_OPTIONS = [
  { value: 'off', label: de.settings.trackingOff },
  { value: 'on', label: de.settings.trackingOn },
] as const;

const HAPTICS_OPTIONS = [
  { value: 'off', label: de.settings.hapticsOff },
  { value: 'on', label: de.settings.hapticsOn },
] as const;

const WEATHER_OPTIONS = [
  { value: 'off', label: de.settings.weatherOff },
  { value: 'on', label: de.settings.weatherOn },
] as const;

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>(() => readTheme());
  const weather = useWeatherEnabled();
  const locateOnStart = useBoolSetting('locateOnStart', true);
  const trackSessions = useBoolSetting('trackSessions', true);
  const usageCount = useBoolSetting('usageCount', true);
  // Vibration gibt es nur in der iPhone-App
  const { haptics } = useProviders();
  const hapticsOn = useBoolSetting('haptics', true);
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
      </Section>
      <Section title={de.settings.tracking}>
        {trackSessions !== undefined && (
          <SegmentedControl
            label={de.settings.tracking}
            options={TRACKING_OPTIONS}
            value={trackSessions ? 'on' : 'off'}
            onChange={(v) => void setSetting('trackSessions', v === 'on')}
          />
        )}
      </Section>
      <Section title={de.settings.usage}>
        {usageCount !== undefined && (
          <SegmentedControl
            label={de.settings.usage}
            options={USAGE_OPTIONS}
            value={usageCount ? 'on' : 'off'}
            onChange={(v) => void setSetting('usageCount', v === 'on')}
          />
        )}
      </Section>
      <SyncStatusSection />
      <PushSettings />
      {haptics.available && (
        <Section title={de.settings.haptics}>
          {hapticsOn !== undefined && (
            <SegmentedControl
              label={de.settings.haptics}
              options={HAPTICS_OPTIONS}
              value={hapticsOn ? 'on' : 'off'}
              onChange={(v) => void setSetting('haptics', v === 'on')}
            />
          )}
        </Section>
      )}
      <Section title={de.settings.weather}>
        {weather !== undefined && (
          <SegmentedControl
            label={de.settings.weather}
            options={WEATHER_OPTIONS}
            value={weather ? 'on' : 'off'}
            onChange={(v) => void setSetting('weatherEnabled', v === 'on')}
          />
        )}
      </Section>
    </Page>
  );
}
