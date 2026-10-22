// Erfundene Testdaten (nur für Tests): keine echten Rechtsangaben.
import type { RegulationSet } from '../../domain/regulations';

export const regulationFixture: RegulationSet = {
  stateCode: 'NW',
  status: 'partial',
  missing: ['Erlaubnisse'],
  checkedAt: '2026-10-01',
  checkedBy: 'Test',
  legalBasis: [
    {
      id: 'TVO',
      title: 'Testverordnung',
      version: 'Testfassung',
      url: 'https://example.org/testverordnung',
      retrievedAt: '2026-10-01',
    },
  ],
  closedSeasons: [
    {
      taxon: { de: 'Hecht', sci: 'Esox lucius' },
      speciesId: 'pike',
      from: { month: 2, day: 15 },
      to: { month: 4, day: 30 },
      basisId: 'TVO',
      basisRef: '§ 1 Abs. 1',
    },
    {
      taxon: { de: 'Bachforelle', sci: 'Salmo trutta f. fario' },
      speciesId: 'brown_trout',
      from: { month: 10, day: 1 },
      to: { month: 3, day: 1 },
      scope: 'nur Testgewässer',
      basisId: 'TVO',
      basisRef: '§ 1 Abs. 2',
    },
  ],
  minSizes: [
    {
      taxon: { de: 'Hecht', sci: 'Esox lucius' },
      speciesId: 'pike',
      minCm: 50,
      basisId: 'TVO',
      basisRef: '§ 2',
    },
  ],
  protectedSpecies: [{ taxon: { de: 'Nase', sci: 'Chondrostoma nasus' }, basisId: 'TVO', basisRef: '§ 3' }],
  licences: [],
  otherRules: [{ topic: 'Testthema', text: 'Testregel.', basisId: 'TVO', basisRef: '§ 4' }],
};
