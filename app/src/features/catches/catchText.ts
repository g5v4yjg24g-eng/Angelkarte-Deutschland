import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { speciesById } from '../../domain/species';

/** „Fang · Zander" – Ergebnis und, falls bekannt, Art. */
export const catchTitle = (c: Catch) => {
  const species = speciesById(c.speciesId);
  return `${de.map.outcomes[c.outcome]}${species ? ` · ${species.de}` : ''}`;
};
