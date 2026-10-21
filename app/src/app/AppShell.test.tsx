import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from './router';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('AppShell', () => {
  it('hat vier Hauptbereiche in der Navigation und markiert den aktiven', () => {
    renderAt('/fangbuch');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = ['Karte', 'Fangbuch', 'Statistik', 'Mehr'].map((n) =>
      screen.getByRole('link', { name: n }),
    );
    links.forEach((l) => expect(nav).toContainElement(l));
    expect(screen.getByRole('link', { name: 'Fangbuch' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Fangbuch' })).toBeInTheDocument();
  });

  it('meldet dem Intro, dass die App bereit ist', () => {
    const ready = vi.fn();
    window.__fangpunktAppReady = ready;
    renderAt('/');
    expect(ready).toHaveBeenCalled();
    delete window.__fangpunktAppReady;
  });

  it('zeigt offline einen Hinweis und blendet ihn online wieder aus', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderAt('/');
    expect(screen.getByText('Offline')).toBeInTheDocument();
    spy.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByText('Offline')).toBeNull();
    spy.mockRestore();
  });

  it('zeigt für unbekannte Pfade eine verständliche Seite', () => {
    renderAt('/gibt-es-nicht');
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();
  });
});
