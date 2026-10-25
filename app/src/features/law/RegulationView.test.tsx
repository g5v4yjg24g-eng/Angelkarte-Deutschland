import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { regulationFixture as fx } from '../../test/fixtures/regulations';
import { RegulationView } from './RegulationView';

const at = (d: string) => Date.parse(`${d}T10:00:00Z`);

describe('RegulationView', () => {
  it('zeigt Hinweis, Status, fehlende Teile, Fundstellen und Quellen', () => {
    render(<RegulationView set={fx} nowMs={at('2026-10-15')} />);
    expect(screen.getByText(/Keine Rechtsauskunft/)).toBeInTheDocument();
    expect(screen.getByText('Teilweise geprüft')).toBeInTheDocument();
    expect(screen.getByText('Zuletzt geprüft am 01.10.2026')).toBeInTheDocument();
    expect(screen.getByText('Noch nicht erfasst: Erlaubnisse.')).toBeInTheDocument();
    expect(screen.getByText('15.02.–30.04.')).toBeInTheDocument();
    expect(screen.getAllByText('§ 1 Abs. 1 TVO').length).toBe(1);
    expect(screen.getByText('ab 50 cm')).toBeInTheDocument();
    expect(screen.getByText('Nase')).toBeInTheDocument();
    expect(screen.getByText('(Chondrostoma nasus)', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Testverordnung (TVO)' })).toHaveAttribute(
      'href',
      'https://example.org/testverordnung',
    );
    expect(screen.queryByText(/möglicherweise veraltet/)).not.toBeInTheDocument();
  });

  it('LAW-3: am 15.01. ist die jahresübergreifende Schonzeit aktiv, die Frühjahrs-Schonzeit nicht', () => {
    render(<RegulationView set={fx} nowMs={at('2027-01-15')} />);
    const rows = screen.getAllByRole('listitem');
    const trout = rows.find((r) => within(r).queryByText('Bachforelle'));
    const pike = rows.find((r) => within(r).queryByText('15.02.–30.04.'));
    expect(trout).toBeDefined();
    expect(pike).toBeDefined();
    expect(within(trout as HTMLElement).getByText('Heute in Schonzeit')).toBeInTheDocument();
    expect(within(pike as HTMLElement).queryByText('Heute in Schonzeit')).not.toBeInTheDocument();
  });

  it('LAW-2: nach 180 Tagen „möglicherweise veraltet", nach 365 Tagen deutlicher', () => {
    const { unmount } = render(<RegulationView set={fx} nowMs={at('2027-04-15')} />);
    expect(screen.getByText(/01\.10\.2026 – möglicherweise veraltet/)).toBeInTheDocument();
    unmount();
    render(<RegulationView set={fx} nowMs={at('2027-11-15')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('seit über einem Jahr nicht geprüft');
  });

  it('leere Abschnitte sagen das ausdrücklich', () => {
    render(<RegulationView set={{ ...fx, minSizes: [] }} nowMs={at('2026-10-15')} />);
    expect(screen.getAllByText('In den Angaben für dieses Land nicht enthalten.').length).toBe(2); // Mindestmaße + Erlaubnisse
  });

  it('Entnahmefenster, Tageshöchstmenge und Entwurfsbanner', () => {
    const set = {
      ...fx,
      status: 'draft' as const,
      minSizes: [
        {
          taxon: { de: 'Zander', sci: 'Stizostedion lucioperca' },
          minCm: 45,
          maxCm: 75,
          dailyLimit: 2,
          basisId: 'TVO',
          basisRef: 'Anlage 1 Nr. 9',
        },
      ],
    };
    render(<RegulationView set={set} nowMs={at('2026-10-15')} />);
    expect(screen.getByText('45–75 cm')).toBeInTheDocument();
    expect(screen.getByText(/^Entnahmefenster/)).toBeInTheDocument();
    expect(screen.getByText('höchstens 2 Stück pro Tag')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('ungeprüfter Entwurf');
    expect(screen.getByText('Entwurf')).toBeInTheDocument();
  });

  it('LAW-6: Fischart suchen und „Nur Fische in der Schonzeit“', async () => {
    const user = userEvent.setup();
    render(<RegulationView set={fx} nowMs={at('2027-03-10')} />);
    const search = screen.getByRole('searchbox', { name: 'Fischart suchen' });
    await user.type(search, 'forelle');
    expect(screen.getByText('Bachforelle')).toBeInTheDocument();
    expect(screen.queryByText('Hecht')).not.toBeInTheDocument();
    expect(screen.queryByText('Testregel.')).not.toBeInTheDocument(); // weitere Regeln ausgeblendet
    expect(screen.getByText('1 Angabe gefunden')).toHaveAttribute('role', 'status');

    await user.clear(search);
    await user.type(search, 'karpfen');
    expect(screen.getByText('Keine passende Fischart in den Angaben für dieses Land.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(search).toHaveValue('');
    expect(screen.getByText('Testregel.')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Nur Fische in der Schonzeit' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Stand heute \(10\.03\.\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Hecht').length).toBe(2); // Schonzeit + Mindestmaß
    expect(screen.queryByText('Bachforelle')).not.toBeInTheDocument();
    expect(screen.getByText('Nase')).toBeInTheDocument();
  });
});
