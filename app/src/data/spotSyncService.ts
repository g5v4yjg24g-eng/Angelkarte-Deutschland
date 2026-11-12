// Eigene Orte mit angenommenen Partnern teilen (Spot-Verbindungen): lädt hoch, was neu oder geändert ist, und entfernt
// Orte, die nicht mehr geteilt werden. Merker je Gerät (siehe domain/spotSync.ts). Fehler stören nie die App – der
// nächste Lauf macht dort weiter.
import { shareInput } from '../domain/sharedSpots';
import type { Place } from '../domain/schemas';
import { uploadsTo } from '../domain/spotLinks';
import {
  planSpotSync,
  pruneSpotPartners,
  withUploaded,
  withoutPlace,
  type SpotSyncState,
} from '../domain/spotSync';
import type { AccountProvider } from '../ports/account';

export interface SpotSyncDeps {
  account: Pick<AccountProvider, 'spotLinks' | 'shareSpot' | 'unsharePlace'>;
  places: () => Promise<Place[]>;
  load: () => SpotSyncState;
  save: (state: SpotSyncState) => void;
  /** höchstens so viele Uploads je Lauf (der Rest folgt beim nächsten) */
  limit?: number;
}

export interface SpotSyncResult {
  partners: number;
  uploaded: number;
  removed: number;
  /** es ist noch etwas übrig (Limit erreicht) */
  more: boolean;
}

let running: Promise<SpotSyncResult> | undefined;

const isLinkGone = (e: unknown) => e instanceof Error && /no_link|not_friends/.test(e.message);

/** Ein Abgleich gleichzeitig; ein zweiter Aufruf bekommt den laufenden */
export function runSpotSync(deps: SpotSyncDeps): Promise<SpotSyncResult> {
  running ??= sync(deps).finally(() => {
    running = undefined;
  });
  return running;
}

async function sync(deps: SpotSyncDeps): Promise<SpotSyncResult> {
  const links = await deps.account.spotLinks();
  const partners = uploadsTo(links).map((l) => l.partnerId);
  let state = pruneSpotPartners(deps.load(), partners);
  const plan = planSpotSync(await deps.places(), partners, state);
  const limit = deps.limit ?? 200;
  const skipped = new Set<string>();
  let uploaded = 0;
  let removed = 0;
  try {
    for (const id of plan.removals) {
      await deps.account.unsharePlace(id);
      state = withoutPlace(state, id);
      removed++;
    }
    for (const { place, partnerId } of plan.uploads) {
      if (uploaded >= limit) break;
      if (skipped.has(partnerId)) continue;
      try {
        await deps.account.shareSpot(shareInput(place, partnerId));
        state = withUploaded(state, place, partnerId);
        uploaded++;
      } catch (e) {
        // Verbindung inzwischen beendet: diese Person überspringen, nicht alles abbrechen
        if (isLinkGone(e)) skipped.add(partnerId);
        else throw e;
      }
    }
  } finally {
    deps.save(state);
  }
  const open = plan.uploads.filter((u) => !skipped.has(u.partnerId)).length;
  return { partners: partners.length, uploaded, removed, more: open > uploaded };
}
