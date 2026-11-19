import { describe, expect, it } from 'vitest';
import { SPECIES, speciesById, speciesIdFromName } from './species';

describe('Artenliste', () => {
  it('IDs sind eindeutig und passen zur Serverprüfung (posts.species_id)', () => {
    const ids = SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
  });

  it('Namen und Alias-Namen sind eindeutig (sonst ist die Zuordnung nach Namen zweideutig)', () => {
    const names = SPECIES.flatMap((s) => [s.de, ...(s.aliases ?? [])].map((n) => n.trim().toLowerCase()));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('„Andere Art“ bleibt als letzte Auswahl', () => {
    expect(SPECIES.at(-1)?.id).toBe('other');
  });

  it('neue Süßwasser- und Meeresarten sind auswählbar und per Name oder Alias auffindbar', () => {
    expect(speciesById('cod')?.de).toBe('Dorsch');
    expect(speciesIdFromName('Kabeljau')).toBe('cod');
    expect(speciesIdFromName('Donaulachs')).toBe('huchen');
    expect(speciesIdFromName('Schied')).toBe('asp');
    expect(speciesIdFromName('flunder')).toBe('flounder');
  });
});
