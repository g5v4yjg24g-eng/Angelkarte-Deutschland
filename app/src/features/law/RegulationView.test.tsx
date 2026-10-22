import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('50 cm')).toBeInTheDocument();
    expect(screen.getByText('Nase')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Testverordnung (TVO)' })).toHaveAttribute(
      'href',
      'https://example.org/testverordnung',
    );
    expect(screen.queryByText(/möglicherweise veraltet/)).not.toBeInTheDocument();
  });

  it('LAW-3: am 15.01. ist die jahresübergreifende Schonzeit aktiv, die Frühjahrs-Schonzeit nicht', () => {
    render(<RegulationView set={fx} nowMs={at('2027-01-15')} />);
    const rows = screen.getAllByRole('row');
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
});
