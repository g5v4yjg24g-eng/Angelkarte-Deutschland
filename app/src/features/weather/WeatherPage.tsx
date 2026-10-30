// Bereich „Wetter" (Wunsch Nutzer 2026-10-22): Vorhersage für Standort oder ein Gewässer aus dem Fangbuch,
// Luftdruck-Verlauf und die nächsten Tage. Modellwerte von Open-Meteo, nur gerundete Koordinaten.
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { Button } from '../../design/components/Button';
import { SelectField } from '../../design/components/Field';
import { compassIndex } from '../../domain/weather';
import {
  daySummaries,
  forecastQuery,
  hourAt,
  pressureChange,
  PRESSURE_SPAN_H,
  type Forecast,
} from '../../domain/forecast';
import { useWeatherEnabled } from './useWeatherEnabled';
import { useForecast } from './useForecast';
import { useCurrentPosition, useForecastChoice, useWaterOptions } from './useForecastPlace';
import { PressureChart } from './PressureChart';
import { BiteWindows } from './BiteWindows';
import { WeatherTabs } from './WeatherTabs';
import { WeatherAlerts } from './AlertsList';
import { GaugeCard } from './GaugeCard';
import { ForecastOverview } from './ForecastOverview';

const t = de.forecast;
const w = de.weather;
const stamp = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const berlinDate = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

function ForecastView({
  f,
  nowMs,
  stale,
  placeLabel,
}: {
  f: Forecast;
  nowMs: number;
  stale: boolean;
  placeLabel: string;
}) {
  const now = hourAt(f, nowMs);
  const change = now ? pressureChange(f, now.t) : undefined;
  // Vergangene Tage (past_days) und Stunden vor heute 0 Uhr ausblenden
  const todayStart = f.days.find((d) => berlinDate(d.t) === berlinDate(nowMs))?.t ?? f.days[0]?.t ?? 0;
  const days = useMemo(() => daySummaries(f).filter((d) => d.t >= todayStart), [f, todayStart]);
  const chartHours = f.hours.filter((h) => h.t >= nowMs - 12 * 3_600_000);
  return (
    <>
      {stale && <Notice tone="warning">{t.offlineCached(stamp(f.fetchedAt))}</Notice>}
      <ForecastOverview f={f} days={days} now={now} nowMs={nowMs} placeLabel={placeLabel} />
      <Section title={t.pressureChart}>
        {now?.pressureHpa !== undefined && (
          <p className="muted">
            {w.pressureValue(now.pressureHpa)}
            {change !== undefined && ` · ${t.pressureChange(change, PRESSURE_SPAN_H)}`}
            {now.windMs !== undefined &&
              ` · ${w.wind} ${w.windValue(
                now.windMs,
                now.windDirDeg === undefined ? undefined : w.compass[compassIndex(now.windDirDeg)],
                now.gustMs,
              )}`}
          </p>
        )}
        <PressureChart hours={chartHours} days={days} nowMs={nowMs} />
      </Section>
      <BiteWindows nowMs={nowMs} now={now} change={change} />
      <p className="muted">
        {t.note} {t.source(stamp(f.fetchedAt))}
      </p>
    </>
  );
}

export function WeatherPage() {
  const enabled = useWeatherEnabled();
  const waters = useWaterOptions();
  const [choice, setChoice] = useForecastChoice();
  const water = waters?.find((o) => o.key === choice);
  const useMe = choice === 'me' || (waters !== undefined && !water);
  const geo = useCurrentPosition(!!enabled && useMe);
  const pos = useMe ? (geo.status === 'ok' ? geo : undefined) : water;
  const lat = pos?.lat;
  const lng = pos?.lng;
  const q = useMemo(
    () => (lat !== undefined && lng !== undefined ? forecastQuery({ lat, lng }) : undefined),
    [lat, lng],
  );
  const { state, reload } = useForecast(enabled ? q : undefined);
  const [nowMs] = useState(() => Date.now());

  const placeLabel = useMe ? t.myLocation : (water?.label ?? t.myLocation);

  const options = [
    { value: 'me', label: t.myLocationRounded },
    ...(waters ?? []).map((o) => ({ value: o.key, label: o.sub ? `${o.label} (${o.sub})` : o.label })),
  ];

  let body: React.ReactNode;
  if (enabled === undefined) body = <Notice>{t.loading}</Notice>;
  else if (!enabled)
    body = (
      <Notice>
        <Link to="/mehr/einstellungen">{t.off}</Link>
      </Notice>
    );
  else if (useMe && geo.status === 'denied') body = <Notice tone="warning">{t.locationDenied}</Notice>;
  else if (useMe && geo.status !== 'ok') body = <Notice>{t.locating}</Notice>;
  else if (state.status === 'ok')
    body = <ForecastView f={state.forecast} nowMs={nowMs} stale={state.stale} placeLabel={placeLabel} />;
  else if (state.status === 'error')
    body = (
      <Notice tone="error">
        {state.offline ? t.offlineNone : t.error}{' '}
        <Button variant="ghost" onClick={reload}>
          {t.retry}
        </Button>
      </Notice>
    );
  else if (state.status === 'loading' && state.cached)
    body = <ForecastView f={state.cached} nowMs={nowMs} stale={false} placeLabel={placeLabel} />;
  else body = <Notice>{t.loading}</Notice>;

  return (
    <Page title={t.title}>
      <WeatherTabs />
      {enabled && (
        <>
          <SelectField
            label={t.place}
            options={options}
            value={useMe ? 'me' : choice}
            onChange={(e) => setChoice(e.target.value)}
          />
          {waters?.length === 0 && <p className="muted">{t.noPlaces}</p>}
        </>
      )}
      {/* Warnungen zuerst: Sicherheit vor allem anderen */}
      {enabled && q && <WeatherAlerts lat={q.lat} lng={q.lng} nowMs={nowMs} />}
      {body}
      {/* Pegel nach der Vorhersage; ohne Positionsübertragung (ganze Stationsliste, Suche auf dem Gerät) */}
      {enabled && q && <GaugeCard lat={q.lat} lng={q.lng} />}
    </Page>
  );
}
