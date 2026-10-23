// Wetter am Fangort direkt im Erfassungsformular („Mehr Details“ → Bedingungen): Modellwerte für die Stunde des
// Eintrags, sobald Ort und Zeit feststehen. Sie werden mit dem Eintrag gespeichert; „In die Felder übernehmen“
// füllt Himmel, Lufttemperatur und Wind (Bft). Die Felder bleiben deine eigenen Angaben.
import { useMemo } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { compassIndex, type WeatherSnapshot } from '../../domain/weather';
import { formatDateTime } from '../../lib/storage';
import type { FormWeatherState } from './useFormWeather';
import styles from './CatchWeather.module.css';

const t = de.weather;
const f = de.catchForm;

export function FormWeather({
  state,
  onApply,
}: {
  state: FormWeatherState;
  onApply: (snap: WeatherSnapshot) => void;
}) {
  const rows = useMemo(() => {
    if (state.status !== 'ok') return [];
    const w = state.snap;
    return (
      [
        [t.sky, w.code === undefined ? undefined : (t.codes[w.code] ?? t.codeUnknown(w.code))],
        [t.temp, w.tempC === undefined ? undefined : t.tempValue(w.tempC)],
        [
          t.wind,
          w.windMs === undefined
            ? undefined
            : t.windValue(
                w.windMs,
                w.windDirDeg === undefined ? undefined : t.compass[compassIndex(w.windDirDeg)],
                w.gustMs,
              ),
        ],
        [
          t.pressure,
          w.pressureHpa === undefined ? undefined : t.pressureValue(w.pressureHpa, w.pressureTrend3h),
        ],
      ] as [string, string | undefined][]
    ).filter((r): r is [string, string] => !!r[1]);
  }, [state]);

  return (
    <section className={styles.formBox} aria-label={f.weatherTitle} data-weather={state.status}>
      <h4 className={styles.title}>{f.weatherTitle}</h4>
      {state.status === 'ok' ? (
        <>
          <dl className={styles.formFacts}>
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className={`muted ${styles.note}`}>
            {t.modelNote(formatDateTime(state.snap.forHour))} {f.weatherSaved} {t.source}
          </p>
          <div>
            <Button variant="secondary" onClick={() => onApply(state.snap)}>
              {f.weatherApply}
            </Button>
          </div>
        </>
      ) : state.status === 'off' ? (
        <p className="muted">
          <Link to="/mehr/einstellungen">{t.off}</Link>
        </p>
      ) : (
        <p className="muted">{f.weatherStates[state.status]}</p>
      )}
    </section>
  );
}
