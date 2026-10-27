import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RigDetailPage } from './RigDetailPage';
import { RigsPage } from './RigsPage';

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mehr/montagen" element={<RigsPage />} />
        <Route path="/mehr/montagen/:rig" element={<RigDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Montagen (RIG-3)', () => {
  it('Liste mit Filter nach Angelart', () => {
    open('/mehr/montagen');
    expect(screen.getByRole('link', { name: /Carolina-Rig/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Posenangeln' }));
    expect(screen.queryByRole('link', { name: /Carolina-Rig/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Laufposenmontage/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Montagen' })).toHaveAttribute('aria-current', 'page');
  });

  it('Anleitung: Wofür, Zeichnung mit Beschriftung, Schritte, Material, passende Knoten', () => {
    open('/mehr/montagen/carolina-rig');
    expect(screen.getByRole('heading', { level: 1, name: 'Carolina-Rig' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Wofür?' })).toHaveTextContent(/Plateaus/);
    expect(screen.getByText('Schritt 1 von 5')).toBeInTheDocument();
    const drawing = screen.getByRole('img', { name: /^Carolina-Rig: Das Patronenblei/ });
    expect(within(drawing).getByText('Patronenblei')).toBeInTheDocument();
    expect(within(drawing).queryByText('Gummiköder')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Zu Schritt 5:/ }));
    expect(within(screen.getByRole('img')).getByText('Gummiköder')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Das brauchst du' })).toHaveTextContent(/Offsethaken/);
    expect(screen.getByRole('link', { name: /Palomarknoten/ })).toHaveAttribute(
      'href',
      '/mehr/knoten/palomar',
    );
  });

  it('unbekannte Montage', () => {
    open('/mehr/montagen/gibt-es-nicht');
    expect(screen.getByText('Diese Montage gibt es nicht.')).toBeInTheDocument();
  });
});
