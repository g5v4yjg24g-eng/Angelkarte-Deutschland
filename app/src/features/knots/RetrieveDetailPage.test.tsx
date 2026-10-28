import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RetrieveDetailPage } from './RetrieveDetailPage';
import { RetrievesPage } from './RetrievesPage';

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mehr/koederfuehrung" element={<RetrievesPage />} />
        <Route path="/mehr/koederfuehrung/:retrieve" element={<RetrieveDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Köderführung (RET-2)', () => {
  it('Liste mit drei Reitern und Filter nach Wassertiefe', () => {
    open('/mehr/koederfuehrung');
    expect(screen.getByRole('link', { name: 'Köderführung' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Montagen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Im Mittelwasser' }));
    expect(screen.queryByRole('link', { name: /^Jiggen/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Twitchen/ })).toBeInTheDocument();
  });

  it('Anleitung: Wofür, Zeichnung mit Köder und Beschriftung, Schritte, passende Montagen', () => {
    open('/mehr/koederfuehrung/schleifen');
    expect(screen.getByRole('heading', { level: 1, name: 'Schleifen (Dragging)' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Wofür?' })).toHaveTextContent(/träge Fische/);
    const drawing = screen.getByRole('img', { name: /^Schleifen \(Dragging\): Auswerfen/ });
    expect(within(drawing).getByText('absinken lassen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Zu Schritt 2:/ }));
    expect(within(screen.getByRole('img')).getByText('Rute langsam seitlich ziehen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Carolina-Rig/ })).toHaveAttribute(
      'href',
      '/mehr/montagen/carolina-rig',
    );
  });

  it('unbekannte Technik', () => {
    open('/mehr/koederfuehrung/gibt-es-nicht');
    expect(screen.getByText('Diese Köderführung gibt es nicht.')).toBeInTheDocument();
  });
});
