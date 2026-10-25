// LAW-4: Land ohne (sichtbare) Landesdatei → erklärender Leerzustand mit Link zum Landesrechtsportal.
// Seit alle 16 Länder Angaben haben, lässt sich das nicht mehr mit echten Daten im E2E-Test zeigen.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StateLawPage } from './StateLawPage';

vi.mock('./useRegulation', () => ({ useRegulation: () => ({ kind: 'none' }) }));

describe('StateLawPage', () => {
  it('LAW-4: ohne Angaben ein Leerzustand mit Link zum Portal und Hinweis „keine Rechtsauskunft"', () => {
    render(
      <MemoryRouter initialEntries={['/mehr/recht/SN']}>
        <Routes>
          <Route path="/mehr/recht/:state" element={<StateLawPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Für Sachsen noch keine geprüften Angaben' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zum Landesrechtsportal' }).getAttribute('href')).toMatch(
      /^https:\/\//,
    );
    expect(screen.getByText(/^Keine Rechtsauskunft\./)).toBeTruthy();
  });
});
