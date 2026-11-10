// Admin → Nutzer (Nutzerverwaltung, Wunsch Nutzer 2026-11-10): alle Konten, neueste zuerst, mit Auswahl (gemeldet,
// verwarnt, gesperrt) und Suche nach Name, Nutzer-ID oder – nur Founder-Konto – E-Mail (exakt, wird protokolliert).
// Je Konto nur das für die Moderation Nötige: Profilbild, Name, seit wann, Stand, Meldungen, aktive Verwarnungen.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { TextField } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import { USER_FILTERS, USER_PAGE, type ModUserFilter, type ModUserRow } from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { Avatar } from '../../profile/Avatar';
import { useAvatarUrls } from '../../profile/avatarUrls';
import { adminUser } from './adminPaths';
import { modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;
const u = t.users;
const FILTERS = USER_FILTERS.map((value) => ({ value, label: u.filters[value] }));
const isFilter = (v: string | null): v is ModUserFilter =>
  !!v && (USER_FILTERS as readonly string[]).includes(v);
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });

interface Loaded {
  key: string;
  list?: ModUserRow[];
  error?: string;
  /** es kann weitere Seiten geben */
  more?: boolean;
}

export function ModUsersPage() {
  const { account } = useProviders();
  // Auswahl und Suche stehen in der Adresse (Zurück-Taste, Schnellzugriff „Gemeldete Konten“)
  const [params, setParams] = useSearchParams();
  const filter: ModUserFilter = isFilter(params.get('auswahl'))
    ? (params.get('auswahl') as ModUserFilter)
    : 'all';
  const query = params.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [emailAllowed, setEmailAllowed] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>();
  const [loadingMore, setLoadingMore] = useState(false);
  const key = `${filter}|${query}`;
  const list = loaded?.key === key ? loaded.list : undefined;
  const error = loaded?.key === key ? loaded.error : undefined;
  const avatars = useAvatarUrls((list ?? []).map((x) => x.userId));

  useEffect(() => {
    let live = true;
    void account.modCanSearchEmail().then((ok) => live && setEmailAllowed(ok));
    return () => {
      live = false;
    };
  }, [account]);

  useEffect(() => {
    let live = true;
    account
      .modUsers(query, filter)
      .then((l) => live && setLoaded({ key, list: l, more: l.length >= USER_PAGE }))
      .catch((e: unknown) => live && setLoaded({ key, error: modErrorText(e) }));
    return () => {
      live = false;
    };
  }, [account, filter, query, key]);

  const update = (next: { auswahl?: ModUserFilter; q?: string }) => {
    const p = new URLSearchParams(params);
    const f = next.auswahl ?? filter;
    const q = (next.q ?? query).trim();
    if (f === 'all') p.delete('auswahl');
    else p.set('auswahl', f);
    if (q) p.set('q', q);
    else p.delete('q');
    setParams(p, { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: input });
  };

  const loadMore = useCallback(async () => {
    const last = list?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const next = await account.modUsers(query, filter, last.joined);
      setLoaded({ key, list: [...(list ?? []), ...next], more: next.length >= USER_PAGE });
    } catch (e) {
      setLoaded({ key, ...(list ? { list } : {}), error: modErrorText(e) });
    } finally {
      setLoadingMore(false);
    }
  }, [account, filter, key, list, query]);

  return (
    <Page title={u.title}>
      <form className={styles.search} onSubmit={submit} role="search">
        <TextField
          label={u.searchLabel}
          type="search"
          value={input}
          placeholder={emailAllowed ? u.searchPlaceholderEmail : u.searchPlaceholder}
          hint={emailAllowed ? `${u.searchHint} ${u.searchHintEmail}` : u.searchHint}
          maxLength={200}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className={styles.buttons}>
          <Button type="submit">{u.search}</Button>
          {query && (
            <Button
              variant="ghost"
              onClick={() => {
                setInput('');
                update({ q: '' });
              }}
            >
              {u.clear}
            </Button>
          )}
        </div>
      </form>
      <SegmentedControl
        label={u.filterLabel}
        options={FILTERS}
        value={filter}
        onChange={(v) => update({ auswahl: v })}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{t.loading}</p>}
      {list && list.length === 0 && <p className="muted">{query ? u.emptySearch : u.empty}</p>}
      {list && list.length > 0 && (
        <ul className={styles.list}>
          {list.map((x) => (
            <li key={x.userId}>
              <Link to={adminUser(x.userId)} className={`${styles.item} ${styles.userItem}`}>
                <Avatar url={avatars.get(x.userId)} size={44} />
                <span className={styles.userText}>
                  <span className={styles.row}>
                    <strong>{x.displayName}</strong>
                    {x.banned && (
                      <span className={styles.tagDanger}>
                        {x.banUntil ? u.bannedUntil(day(x.banUntil)) : u.bannedForever}
                      </span>
                    )}
                    {x.activeWarnings > 0 && (
                      <span className={styles.tagWork}>{u.warnings(x.activeWarnings)}</span>
                    )}
                  </span>
                  <span className="muted">
                    {t.handle(x.username)} · {u.joined(day(x.joined))}
                  </span>
                  {x.reportsAgainst > 0 && (
                    <span className="muted">{u.reports(x.reportsAgainst, x.openReports)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list && list.length > 0 && loaded?.more && (
        <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
          {u.more}
        </Button>
      )}
      {list && list.length > 0 && !loaded?.more && !query && (
        <p className={`muted ${styles.small}`}>{u.end}</p>
      )}
    </Page>
  );
}
