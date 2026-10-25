import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { KnotDetailPage } from './KnotDetailPage';
import { STEP_HOLD_MS } from './KnotPlayer';

const open = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/mehr/knoten/${slug}`]}>
      <Routes>
        <Route path="/mehr/knoten/:knot" element={<KnotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.useRealTimers());

describe('Knoten-Anleitung (KNT-3)', () => {
  it('Schritte vor und zurück, Schritt antippen, Zeichnung beschriftet', () => {
    open('palomar');
    expect(screen.getByRole('heading', { level: 1, name: 'Palomarknoten' })).toBeInTheDocument();
    expect(screen.getByText('Schritt 1 von 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schritt zurück' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Schritt weiter' }));
    expect(screen.getByText('Schritt 2 von 4')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Palomarknoten: Mit der doppelten Schnur/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Zu Schritt 4:/ }));
    expect(screen.getByText('Schritt 4 von 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schritt weiter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Von vorn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Zu Schritt 4:/ })).toHaveAttribute('aria-current', 'step');
  });

  it('Abspielen schaltet nach dem Zeichnen selbst weiter und hält am Ende an', () => {
    vi.useFakeTimers();
    open('uni');
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    expect(screen.getByRole('button', { name: 'Anhalten' })).toBeInTheDocument();
    for (let i = 0; i < 3; i++)
      act(() => {
        vi.advanceTimersByTime(20_000 + STEP_HOLD_MS);
      });
    expect(screen.getByText('Schritt 4 von 4')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole('button', { name: 'Von vorn' })).toBeInTheDocument();
  });

  it('unbekannter oder noch nicht animierter Knoten', () => {
    open('fg');
    expect(screen.getByText('Diesen Knoten gibt es nicht.')).toBeInTheDocument();
  });
});
