import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { ListLink } from './ListLink';
import { SegmentedControl } from './SegmentedControl';
import { IconButton } from './Button';

describe('EmptyState', () => {
  it('zeigt Titel als Überschrift, Text und Hinweis', () => {
    render(
      <EmptyState icon={<span />} title="Noch keine Fänge" note="In Arbeit">
        Erklärung
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'Noch keine Fänge' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Noch keine Fänge' })).toHaveTextContent('Erklärung');
    expect(screen.getByText('In Arbeit')).toBeInTheDocument();
  });
});

describe('ListLink', () => {
  it('ist ein Link, wenn ein Ziel existiert', () => {
    render(<ListLink to="/x" icon={<span />} title="Einstellungen" />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: /Einstellungen/ })).toHaveAttribute('href', '/x');
  });
  it('ist ohne Ziel als nicht verfügbar markiert und kein Link', () => {
    render(<ListLink icon={<span />} title="Recht" />, { wrapper: MemoryRouter });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Recht').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('SegmentedControl', () => {
  it('ist eine Radiogruppe und meldet die Auswahl', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Darstellung"
        options={[
          { value: 'a', label: 'Hell' },
          { value: 'b', label: 'Dunkel' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hell' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('IconButton', () => {
  it('hat einen zugänglichen Namen', () => {
    render(<IconButton label="Schließen" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });
});
