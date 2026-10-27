import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from './router';
import { providers } from './providers';
import { ProvidersProvider } from '../ports/providers';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

function renderAt(path: string, basename?: string) {
  return render(
    <ProvidersProvider value={providers}>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path], ...(basename ? { basename } : {}) })}
      />
    </ProvidersProvider>,
  );
}

describe('AppShell', () => {
  it('hat fünf Hauptbereiche in der Navigation und markiert den aktiven', () => {
    renderAt('/fangbuch');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = ['Karte', 'Fangbuch', 'Profil', 'Wetter', 'Mehr'].map((n) =>
      screen.getByRole('link', { name: n }),
    );
    links.forEach((l) => expect(nav).toContainElement(l));
    expect(screen.getByRole('link', { name: 'Fangbuch' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Fangbuch' })).toBeInTheDocument();
  });

  it('Statistik ist ein Reiter im Fangbuch; die Leiste zeigt dabei das Fangbuch als aktiv', () => {
    renderAt('/statistik');
    expect(screen.getByRole('heading', { level: 1, name: 'Statistik' })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Fangbuch' });
    expect(tabs).toContainElement(screen.getByRole('link', { name: 'Statistik' }));
    expect(screen.getByRole('link', { name: 'Statistik' })).toHaveAttribute('aria-current', 'page');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(nav.querySelector('a[href="/fangbuch"]')?.className).toMatch(/active/);
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

  it('Wischen auf der Leiste öffnet den Bereich auch unter einem Basis-Pfad (GitHub Pages)', async () => {
    // Fehlerbild 2026-10-22: „Seite nicht gefunden", weil der Basis-Pfad doppelt vorangestellt wurde
    // jsdom kennt matchMedia nicht: schmaler Bildschirm (mobile Leiste)
    window.matchMedia = () => ({ matches: false }) as MediaQueryList;
    renderAt('/basis/fangbuch', '/basis');
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = ['Karte', 'Fangbuch', 'Profil', 'Wetter', 'Mehr'].map((n) =>
      screen.getByRole('link', { name: n }),
    );
    expect(links[3]).toHaveAttribute('href', '/basis/wetter');
    links.forEach((l, i) =>
      vi.spyOn(l, 'getBoundingClientRect').mockReturnValue({ left: i * 70, width: 68 } as DOMRect),
    );
    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 350 } as DOMRect);
    nav.setPointerCapture = () => {};
    const fire = (type: string, x: number) =>
      act(() => {
        const target = type === 'pointerdown' ? (links[1] as HTMLElement) : nav;
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 3,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
          }),
        );
      });
    fire('pointerdown', 104);
    for (const x of [140, 180, 220, 245]) fire('pointermove', x);
    fire('pointerup', 245);
    expect(await screen.findByRole('heading', { level: 1, name: 'Wetter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seite nicht gefunden' })).toBeNull();
  });
});
