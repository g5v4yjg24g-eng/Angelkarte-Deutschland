// Admin → Verwaltung → Rollen & Rechte (Wunsch Nutzer 2026-11-10, „Rollenverwaltung vorbereiten“): zeigt die eigene
// Rolle und alle Moderatoren. Vergeben wird bewusst nur im SQL-Editor (über die Nutzer-ID), nie aus der App.
import { useEffect, useState } from 'react';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import type { ModRole, ModRoleEntry } from '../../../domain/modTools';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE } from './adminPaths';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.roles;

export function RolesPage() {
  const { account } = useProviders();
  const [mine, setMine] = useState<ModRole>();
  const [list, setList] = useState<ModRoleEntry[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    void account.modMyRole().then((r) => live && setMine(r));
    account
      .modRoles()
      .then((l) => live && setList(l))
      .catch((e: unknown) => live && setError(modErrorText(e)));
    return () => {
      live = false;
    };
  }, [account]);

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      {mine && (
        <div className={styles.item}>
          <strong>{t.mine(t.names[mine])}</strong>
          <span className="muted">{t.rights[mine]}</span>
        </div>
      )}
      <Section title={t.everyone}>
        {error && <Notice tone="error">{error}</Notice>}
        {!list && !error && <p className="muted">{de.modAdmin.loading}</p>}
        {list && (
          <ul className={styles.list}>
            {list.map((m) => (
              <li key={m.userId} className={styles.item}>
                <span className={styles.row}>
                  <strong>{m.displayName ?? '–'}</strong>
                  <span className={m.role === 'founder' ? styles.tagWork : styles.tag}>
                    {t.names[m.role]}
                  </span>
                </span>
                <span className="muted">
                  {m.username && `${de.modAdmin.handle(m.username)} · `}
                  {t.since(modDate(m.since))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t.howTitle}>
        <p className="muted">{t.intro}</p>
        <p className="muted">{t.how}</p>
      </Section>
    </Page>
  );
}
