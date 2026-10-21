import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

// jsdom kennt <dialog>.showModal nur eingeschränkt: minimal nachbilden
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  setTimeout(() => this.dispatchEvent(new Event('close')), 0);
};

describe('Sheet', () => {
  it('ein verspätetes close-Ereignis schließt ein direkt danach geöffnetes Sheet nicht', async () => {
    const onClose = vi.fn();
    let setOpen: (v: boolean) => void = () => {};
    function Host() {
      const [open, set] = useState(true);
      setOpen = set;
      return (
        <Sheet open={open} title="Test" onClose={onClose}>
          Inhalt
        </Sheet>
      );
    }
    render(<Host />);
    expect(screen.getByRole('dialog', { name: 'Test' })).toBeInTheDocument();
    act(() => setOpen(false)); // App schließt selbst …
    act(() => setOpen(true)); // … und öffnet sofort wieder
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Test' })).toBeInTheDocument();
  });
});
