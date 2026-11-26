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
import { TripReminderSettings } from './TripReminderSettings';
import { useProviders } from '../../ports/providersContext';
import { ListLink } from '../../design/components/ListLink';
import { BookIcon } from '../../design/icons';
import cardStyles from '../../design/components/Page.module.css';
import { useLiveAvailable } from '../sessions/liveActivity/useLiveAvailable';

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

const CHECK_OPTIONS = [
  { value: 'off', label: de.settings.sessionCheckOff },
  { value: 'on', label: de.settings.sessionCheckOn },
] as const;

const LIVE_OPTIONS = [
  { value: 'off', label: de.settings.liveActivityOff },
  { value: 'on', label: de.settings.liveActivityOn },
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
  const { haptics, reminders } = useProviders();
  const checkOn = useBoolSetting('sessionCheck', true);
  const hapticsOn = useBoolSetting('haptics', true);
  // Live Activity gibt es nur in der iPhone-App ab iOS 16.2 (und wenn das System sie erlaubt)
  const liveAvailable = useLiveAvailable();
  const liveOn = useBoolSetting('liveActivity', true);
  const liveTitle = useBoolSetting('liveActivityTitle', true);
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
      <TripReminderSettings />
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
      {reminders && (
        <Section title={de.settings.sessionCheck}>
          {checkOn !== undefined && (
            <SegmentedControl
              label={de.settings.sessionCheck}
              options={CHECK_OPTIONS}
              value={checkOn ? 'on' : 'off'}
              onChange={(v) => void setSetting('sessionCheck', v === 'on')}
            />
          )}
        </Section>
      )}
      {liveAvailable && (
        <Section title={de.settings.liveActivity}>
          {liveOn !== undefined && (
            <SegmentedControl
              label={de.settings.liveActivity}
              options={LIVE_OPTIONS}
              value={liveOn ? 'on' : 'off'}
              onChange={(v) => void setSetting('liveActivity', v === 'on')}
            />
          )}
          {liveOn && liveTitle !== undefined && (
            <SegmentedControl
              label={de.settings.liveActivityTitle}
              options={LIVE_OPTIONS}
              value={liveTitle ? 'on' : 'off'}
              onChange={(v) => void setSetting('liveActivityTitle', v === 'on')}
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
      <Section title={de.guide.settingsTitle}>
        <div className={cardStyles.card}>
          <ListLink to="/mehr/anleitung" icon={<BookIcon />} title={de.guide.settingsTitle} />
        </div>
      </Section>
    </Page>
  );
}
