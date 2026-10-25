// Abschnitt „Gewässerkarte“ im Gewässerprofil (Wunsch Nutzer 2026-10-25): A geprüfter Eintrag zum Gewässer,
// B sonst die Angelkarten-Seite des Landesverbands, C eigener Link (nur auf diesem Gerät). Links öffnen nur auf Tipp.
import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import { associationsFor, linkHost, normalizeUserUrl, permitFor } from '../../domain/permits';
import type { StateCode } from '../../domain/water';
import { loadPermitData, type PermitData } from '../../data/permits';
import { getWaterLink, removeWaterLink, saveWaterLink } from '../../data/waterLinkService';
import styles from './Permit.module.css';

const t = de.permit;
const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className={styles.linkButton} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function OwnLink({ waterId }: { waterId: string }) {
  const link = useLiveQuery(() => getWaterLink(waterId), [waterId]);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string>();

  const start = () => {
    setUrl(link?.url ?? '');
    setLabel(link?.label ?? '');
    setError(undefined);
    setEditing(true);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeUserUrl(url);
    if (!clean) return setError(t.urlInvalid);
    await saveWaterLink(waterId, clean, label.trim() || undefined);
    setEditing(false);
  };

  if (link === undefined && !editing)
    return (
      <div className={styles.own}>
        <Button variant="secondary" onClick={start}>
          {t.addOwn}
        </Button>
        <p className="muted">{t.ownHint}</p>
      </div>
    );
  if (editing)
    return (
      <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <TextField
          label={t.urlLabel}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={url}
          error={error}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        <TextField
          label={t.labelLabel}
          placeholder={t.labelPlaceholder}
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <p className="muted">{t.ownHint}</p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t.cancel}
          </Button>
          <Button type="submit">{t.save}</Button>
        </div>
      </form>
    );
  if (!link) return null;
  return (
    <div className={styles.own}>
      <span className={styles.kicker}>{t.ownTitle}</span>
      <ExternalLink href={link.url}>{link.label ?? linkHost(link.url)}</ExternalLink>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={start}>
          {t.edit}
        </Button>
        <Button variant="ghost" onClick={() => void removeWaterLink(waterId)}>
          {t.remove}
        </Button>
      </div>
    </div>
  );
}

export function WaterPermitSection({ waterId, state }: { waterId: string; state?: StateCode | undefined }) {
  const [data, setData] = useState<PermitData>();
  useEffect(() => {
    let live = true;
    void loadPermitData().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);

  const permit = data && permitFor(data.waters, waterId);
  const assocs = data ? associationsFor(data.associations?.associations ?? [], state) : [];

  return (
    <section className={styles.section} aria-labelledby="permit-title">
      <h3 id="permit-title" className={styles.title}>
        {t.title}
      </h3>
      {!data ? (
        <p className="muted">{t.loading}</p>
      ) : permit ? (
        <div className={styles.block}>
          <strong>{permit.issuer}</strong>
          {permit.note && <span>{permit.note}</span>}
          <ExternalLink href={permit.url}>{t.toClub}</ExternalLink>
          <span className="muted">{t.checked(fmtDay(permit.checkedAt), linkHost(permit.url))}</span>
        </div>
      ) : (
        <div className={styles.block}>
          <span>{t.none}</span>
          {assocs.length > 0 ? (
            <>
              <span className="muted">{t.assocIntro}</span>
              {assocs.map((a) => (
                <div key={a.url} className={styles.assoc}>
                  <strong>{a.name}</strong>
                  <ExternalLink href={a.url}>{t.toAssoc}</ExternalLink>
                </div>
              ))}
              <span className="muted">{t.assocHint}</span>
            </>
          ) : (
            <span className="muted">{state ? t.noAssoc : t.noState}</span>
          )}
        </div>
      )}
      <OwnLink waterId={waterId} />
      <p className={`muted ${styles.small}`}>{t.disclaimer}</p>
    </section>
  );
}
