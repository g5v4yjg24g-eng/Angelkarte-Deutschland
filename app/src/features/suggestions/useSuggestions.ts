// Profilvorschläge für den Feed („Angler entdecken“): einmal je Sitzung vom Server holen (5 Minuten Zwischenspeicher,
// gemeinsam für alle Ansichten), Folgen über die bestehende Funktion, Ausblenden merkt sich der Server. Fehler stören den
// Feed nie – ohne Vorschläge bleibt er, wie er ist. Der Stand der Karten (gefolgt/angefragt/ausgeblendet) lebt hier und
// nicht im Feed, damit weder die Beiträge neu geladen werden noch die Scrollposition springt.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AccountError } from '../../ports/account';
import { followErrorKind } from '../../domain/follows';
import { isHidden } from '../../domain/moderation';
import {
  FETCH_COUNT,
  MAX_CAROUSELS,
  splitCarousels,
  type FollowState,
  type Suggestion,
} from '../../domain/suggestions';
import { de } from '../../i18n/de';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { useHidden } from '../moderation/hiddenStore';

const TTL_MS = 5 * 60 * 1000;

interface Store {
  user: string | undefined;
  list: Suggestion[] | undefined;
  at: number;
  loading: boolean;
  follow: Map<string, FollowState>;
  dismissed: Set<string>;
  message: string | undefined;
}

let store: Store = fresh(undefined);
let version = 0;
const listeners = new Set<() => void>();

function fresh(user: string | undefined): Store {
  return {
    user,
    list: undefined,
    at: 0,
    loading: false,
    follow: new Map(),
    dismissed: new Set(),
    message: undefined,
  };
}
function emit() {
  version += 1;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Für Tests: Zwischenspeicher leeren */
export function resetSuggestions() {
  store = fresh(undefined);
  emit();
}

export interface SuggestionsApi {
  /** Karussells mit festem Zuschnitt (höchstens 10 je Karussell, keine Person doppelt); Ausgeblendete fallen heraus */
  carousels: Suggestion[][];
  followState: (userId: string) => FollowState;
  follow: (s: Suggestion) => void;
  dismiss: (s: Suggestion) => void;
  message: string | undefined;
  clearMessage: () => void;
}

export function useSuggestions(enabled: boolean): SuggestionsApi {
  const { account } = useProviders();
  const hidden = useHidden();
  const me = enabled && account.enabled ? storedUserId() : undefined;
  useSyncExternalStore(subscribe, () => version);

  useEffect(() => {
    if (!me) return;
    if (store.user !== me) store = fresh(me);
    if (store.loading || (store.list && Date.now() - store.at < TTL_MS)) return;
    store.loading = true;
    account
      .suggestAnglers(FETCH_COUNT)
      .then((list) => {
        if (store.user !== me) return;
        store.list = list;
        store.at = Date.now();
      })
      .catch(() => {
        // kein Netz o. Ä.: ohne Vorschläge weiter, beim nächsten Besuch erneut
        if (store.user === me && !store.list) store.list = [];
        if (store.user === me) store.at = Date.now() - TTL_MS + 30_000;
      })
      .finally(() => {
        if (store.user === me) store.loading = false;
        emit();
      });
  }, [me, account]);

  // Der Zuschnitt in Karussells hängt nur an der geladenen Liste – ausgeblendete Profile lassen eine Lücke statt
  // andere aus dem nächsten Karussell nachrücken zu lassen
  const carousels = useMemo(
    () =>
      me && store.user === me
        ? splitCarousels(
            (store.list ?? []).filter((s) => !isHidden(hidden, 'user', s.userId, s.userId)),
            MAX_CAROUSELS,
          )
            .map((part) => part.filter((s) => !store.dismissed.has(s.userId)))
            .filter((part) => part.length > 0)
        : [],
    // version ändert sich bei jeder Änderung am Speicher
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, hidden, version],
  );

  const follow = useCallback(
    (s: Suggestion) => {
      const now = store.follow.get(s.userId);
      if (now === 'busy' || now === 'requested' || now === 'following') return;
      store.follow.set(s.userId, 'busy');
      emit();
      account
        .follow(s.username)
        .then((r) => {
          // Server-Antwort bestimmt den Stand: privates Konto = angefragt, sonst gefolgt
          store.follow.set(s.userId, r === 'requested' ? 'requested' : 'following');
        })
        .catch((e: unknown) => {
          store.follow.set(s.userId, 'error');
          const kind = followErrorKind(e instanceof AccountError || e instanceof Error ? e : undefined);
          store.message = kind === 'tooMany' ? de.suggest.tooMany : de.suggest.followError;
        })
        .finally(emit);
    },
    [account],
  );

  const dismiss = useCallback(
    (s: Suggestion) => {
      store.dismissed.add(s.userId);
      emit();
      account.dismissSuggestion(s.userId).catch(() => undefined);
    },
    [account],
  );

  return {
    carousels,
    followState: (id) => store.follow.get(id) ?? 'none',
    follow,
    dismiss,
    message: store.message,
    clearMessage: () => {
      store.message = undefined;
      emit();
    },
  };
}
