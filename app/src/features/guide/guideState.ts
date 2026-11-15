import { setSetting } from '../../data/settings';
import { GUIDE_VERSION } from '../../domain/guide';

/** Merken, dass die Person das Willkommensblatt oder die Tour gesehen hat (nur der Stand, keine Inhalte) */
export const markGuideSeen = () => setSetting('guideSeen', GUIDE_VERSION).catch(() => undefined);
