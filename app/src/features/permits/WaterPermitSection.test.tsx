import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PermitData } from '../../data/permits';
import { WaterPermitSection } from './WaterPermitSection';

const data: PermitData = {
  waters: [
    {
      waterId: 'osm:r1',
      waterName: 'Testsee',
      issuer: 'Testverein e.V.',
      url: 'https://www.testverein.example/see',
      note: 'Gastkarten im Vereinsheim.',
      checkedAt: '2026-10-25',
      checkedBy: 'Test',
    },
  ],
  associations: {
    source: { title: 'Test', url: 'https://example.org', retrievedAt: '2026-10-25' },
    associations: [
      { state: 'HH', name: 'Testverband', url: 'https://verband.example/', checkedAt: '2026-10-25' },
    ],
    open: [{ state: 'HB', reason: 'Test' }],
  },
};
vi.mock('../../data/permits', () => ({ loadPermitData: () => Promise.resolve(data) }));
vi.mock('../../data/waterLinkService', () => ({
  getWaterLink: () => Promise.resolve(undefined),
  saveWaterLink: vi.fn(),
  removeWaterLink: vi.fn(),
}));

describe('Gewässerkarte im Profil (PRM-4)', () => {
  it('A: geprüfter Eintrag mit Vereinsseite und Prüfdatum', async () => {
    render(<WaterPermitSection waterId="osm:r1" state="HH" />);
    expect(await screen.findByText('Testverein e.V.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Vereinsseite' })).toHaveAttribute(
      'href',
      'https://www.testverein.example/see',
    );
    expect(screen.getByText('Link geprüft am 25.10.2026 · testverein.example')).toBeInTheDocument();
    expect(screen.queryByText('Testverband')).not.toBeInTheDocument();
  });

  it('B: ohne Eintrag der Landesverband; Land ohne geprüften Verband sagt das', async () => {
    const { unmount } = render(<WaterPermitSection waterId="osm:r2" state="HH" />);
    expect(await screen.findByText('Noch kein geprüfter Eintrag für dieses Gewässer.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Angelkarten des Verbands' })).toHaveAttribute(
      'href',
      'https://verband.example/',
    );
    unmount();
    render(<WaterPermitSection waterId="osm:r2" state="HB" />);
    expect(
      await screen.findByText('Für dieses Bundesland ist noch kein geprüfter Landesverband hinterlegt.'),
    ).toBeInTheDocument();
  });
});
