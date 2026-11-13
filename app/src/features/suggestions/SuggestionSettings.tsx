// Mehr → Konto → Privatsphäre → „Angler entdecken“: wer in Vorschlägen erscheint und was dafür genutzt wird. Jeder
// Schalter speichert sofort auf dem Server und springt bei einem Fehler zurück. Die grobe Region wird erst nach
// ausdrücklichem Einschalten abgefragt (Standort einmalig, auf ca. 10 km gerundet, nie angezeigt).
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { roundRegion, type SuggestionPrefs } from '../../domain/suggestions';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import styles from '../friends/Friends.module.css';
import { localWaters, pushWaters, setWatersOn, writeWatersKey } from './waterShare';

const t = de.suggest.settings;

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('denied'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60_000,
      timeout: 20_000,
    });
  });
}

export function SuggestionSettings() {
  const { account } = useProviders();
  const [prefs, setPrefs] = useState<SuggestionPrefs>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    account
      .suggestionPrefs()
      .then((p) => {
        if (!live) return;
        setPrefs(p);
        setWatersOn(p.watersOn);
      })
      .catch(() => live && setPrefs(undefined));
    return () => {
      live = false;
    };
  }, [account]);

  if (!prefs) return null;
  const me = storedUserId();

  const run = async (name: string, fn: () => Promise<SuggestionPrefs>) => {
    setBusy(name);
    setError(undefined);
    const before = prefs;
    try {
      const next = await fn();
      setPrefs(next);
    } catch (e) {
      setPrefs(before);
      setError(
        e instanceof Error && e.message === 'denied'
          ? de.suggest.settings.regionDenied
          : e instanceof Error && e.message === 'outside'
            ? t.regionOutside
            : t.error,
      );
    } finally {
      setBusy(undefined);
    }
  };

  const setDiscoverable = (v: boolean) =>
    run('discoverable', async () => {
      await account.setSuggestionPrefs({ discoverable: v, watersOn: prefs.watersOn });
      return { ...prefs, discoverable: v };
    });

  const setWaters = (v: boolean) =>
    run('waters', async () => {
      await account.setSuggestionPrefs({ discoverable: prefs.discoverable, watersOn: v });
      setWatersOn(v);
      if (v && me) await pushWaters(account, me, await localWaters());
      else writeWatersKey(null);
      return { ...prefs, watersOn: v };
    });

  const setRegion = (v: boolean) =>
    run('region', async () => {
      if (!v) {
        await account.clearMyRegion();
        return { ...prefs, regionOn: false };
      }
      const pos = await locate().catch(() => {
        throw new Error('denied');
      });
      const cell = roundRegion(pos.coords.latitude, pos.coords.longitude);
      if (!cell) throw new Error('outside');
      await account.setMyRegion(cell);
      return { ...prefs, regionOn: true };
    });

  return (
    <Section title={t.title}>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          checked={prefs.discoverable}
          disabled={busy !== undefined}
          onChange={(e) => void setDiscoverable(e.target.checked)}
        />
        <span>{t.discoverable}</span>
      </label>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          checked={prefs.watersOn}
          disabled={busy !== undefined}
          onChange={(e) => void setWaters(e.target.checked)}
        />
        <span>{t.waters}</span>
      </label>
      <p className="muted">{t.watersHint}</p>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          checked={prefs.regionOn}
          disabled={busy !== undefined}
          onChange={(e) => void setRegion(e.target.checked)}
        />
        <span>{busy === 'region' ? t.locating : t.region}</span>
      </label>
      <p className="muted">{t.regionHint}</p>
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}
