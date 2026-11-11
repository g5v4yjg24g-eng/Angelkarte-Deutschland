// Nutzersuche (Paket 12, Masterprompt 5.1): Treffer unter dem Eingabefeld der Freunde-Seite. Fragt erst ab 3 Zeichen
// und nach einer kurzen Pause beim Tippen; die Grenzen (20 Treffer, 300 Suchen am Tag) setzt der Server.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { searchTerm, type UserHit } from '../../domain/userProfile';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { Avatar } from '../profile/Avatar';
import { useAvatarUrls } from '../profile/avatarUrls';
import styles from './Friends.module.css';

const t = de.friends;
export const SEARCH_DELAY_MS = 350;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; limit: boolean }
  | { kind: 'ready'; hits: UserHit[] };

export function UserSearchResults({
  query,
  busy,
  reloadKey,
  onRequest,
  exclude,
  localCount = 0,
}: {
  query: string;
  busy: boolean;
  /** neu suchen, wenn sich die Freundesliste ändert (Beziehung aktualisieren) */
  reloadKey: number;
  onRequest: (username: string) => void;
  /** Personen, die in der Liste darüber schon stehen */
  exclude?: ReadonlySet<string> | undefined;
  /** Treffer in der Liste darüber (dann kein „Niemand gefunden“) */
  localCount?: number;
}) {
  const { account } = useProviders();
  const term = searchTerm(query.replace(/^@/, ''));
  const key = term ? `${term}|${reloadKey}` : '';
  // Ergebnis gehört zu genau einem Suchbegriff; solange das neue fehlt, gilt „lädt“
  const [result, setResult] = useState<{ key: string; state: State }>();
  const state: State = !term ? { kind: 'idle' } : result?.key === key ? result.state : { kind: 'loading' };
  const avatars = useAvatarUrls(state.kind === 'ready' ? state.hits.map((h) => h.userId) : []);

  useEffect(() => {
    if (!term) return;
    let live = true;
    const timer = setTimeout(() => {
      account
        .searchUsers(term)
        .then((hits) => live && setResult({ key, state: { kind: 'ready', hits } }))
        .catch(
          (e: unknown) =>
            live &&
            setResult({
              key,
              state: {
                kind: 'error',
                limit: e instanceof AccountError && /too_many_searches/.test(e.message),
              },
            }),
        );
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [account, term, key]);

  if (state.kind === 'idle') return null;
  const hits = state.kind === 'ready' ? state.hits.filter((h) => !exclude?.has(h.userId)) : [];
  // alle Treffer stehen schon oben in der Liste
  if (state.kind === 'ready' && state.hits.length > 0 && hits.length === 0) return null;
  return (
    <div className={styles.search} aria-live="polite">
      <h3 className={styles.searchTitle}>{t.searchTitle}</h3>
      {state.kind === 'loading' && <p className="muted">{t.searching}</p>}
      {state.kind === 'error' && <p className="muted">{state.limit ? t.searchLimit : t.searchError}</p>}
      {state.kind === 'ready' && hits.length === 0 && localCount === 0 && (
        <p className="muted">{t.searchNone}</p>
      )}
      {state.kind === 'ready' && hits.length > 0 && (
        <ul className={styles.list} aria-label={t.searchTitle}>
          {hits.map((h) => (
            <li key={h.userId} className={styles.person}>
              <Avatar url={avatars.get(h.userId)} size={40} />
              <span className={styles.who}>
                <strong>
                  <Link
                    to={`/profil/nutzer/${h.username}`}
                    className={styles.nameLink}
                    aria-label={t.openProfile(h.displayName)}
                  >
                    {h.displayName}
                  </Link>
                  {h.badges.includes('founder') && <FounderBadge />}
                </strong>
                <span className="muted">
                  {t.handle(h.username)}
                  {t.relation[h.relation] && ` · ${t.relation[h.relation]}`}
                  {h.followsMe && ` · ${t.followsYou}`}
                </span>
              </span>
              {h.relation === 'none' && (
                <span className={styles.buttons}>
                  <Button variant="secondary" disabled={busy} onClick={() => onRequest(h.username)}>
                    {h.followsMe ? t.followBack : t.send}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
