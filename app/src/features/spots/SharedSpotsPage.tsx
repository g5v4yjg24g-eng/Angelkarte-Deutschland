// Geteilte Spots (Etappe 4, Wunsch Nutzer 2026-11-03): mit mir geteilt (auf der Karte zeigen, übernehmen)
// und von mir geteilt (Teilen beenden). Nur angemeldet – sonst kein Netz.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button, IconButton } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { RefreshIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { adoptSharedSpot } from '../../data/sharedSpotService';
import { userMessage } from '../../data/errors';
import { adoptedPlace, incomingSpots, outgoingSpots } from '../../domain/sharedSpots';
import { spotErrorText } from './spotErrors';
import { useProviders } from '../../ports/providersContext';
import type { MapFocusState } from '../map/MapView';
import { SharedSpotDetails, SpotHead } from './SharedSpotDetails';
import { useSharedSpots } from './useSharedSpots';
import { isHidden } from '../../domain/moderation';
import { useHidden } from '../moderation/hiddenStore';
import styles from './Spots.module.css';

const t = de.spots;

export function SharedSpotsPage() {
  const { account } = useProviders();
  const { state, reload } = useSharedSpots();
  const places = useLiveQuery(() => getDb().places.toArray(), []);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const hidden = useHidden();

  const refresh = <IconButton label={de.feed.refresh} icon={<RefreshIcon />} onClick={() => void reload()} />;

  if (state.kind === 'signedOut')
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  const incoming =
    state.kind === 'ready'
      ? incomingSpots(state.list).filter((x) => !isHidden(hidden, 'spot', x.id, x.ownerId))
      : [];
  const outgoing = state.kind === 'ready' ? outgoingSpots(state.list) : [];

  const unshare = async (id: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await account.unshareSpot(id);
      await reload();
      setToast(t.unshared);
    } catch (e) {
      setError(spotErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.title} back="/profil" action={refresh}>
      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && <Notice tone="error">{spotErrorText(state.error)}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {state.kind === 'ready' && (
        <>
          <Section title={t.incomingTitle}>
            {incoming.length === 0 ? (
              <p className="muted">{t.noIncoming}</p>
            ) : (
              <ul className={styles.list}>
                {incoming.map((s) => (
                  <li key={s.id} className={styles.item}>
                    <SharedSpotDetails
                      spot={s}
                      adopted={!!places && !!adoptedPlace(s, places)}
                      onSafety={setToast}
                      onShowMap={() =>
                        void navigate('/', { state: { focusShared: s.id } satisfies MapFocusState })
                      }
                      onAdopt={() =>
                        void adoptSharedSpot(s, t.adoptOrigin)
                          .then(() => setToast(t.adoptedToast))
                          .catch((e: unknown) => setError(userMessage(e)))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t.outgoingTitle}>
            {outgoing.length === 0 ? (
              <p className="muted">{t.noOutgoing}</p>
            ) : (
              <ul className={styles.list}>
                {outgoing.map((s) => (
                  <li key={s.id} className={styles.item}>
                    <SpotHead spot={s} />
                    <div className={styles.buttons}>
                      <Button variant="secondary" disabled={busy} onClick={() => void unshare(s.id)}>
                        {t.unshare}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}
