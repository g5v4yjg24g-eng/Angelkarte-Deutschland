import { openFreeMap } from '../adapters/openfreemap';
import type { Providers } from '../ports/providersContext';

/** Zusammenstecken der Anbieter (einzige Stelle, die Adapter kennt). */
export const providers: Providers = { basemap: openFreeMap };
