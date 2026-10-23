import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast, TOAST_INFO_MS, TOAST_MS } from './Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mit Aktion: blendet sich nach TOAST_MS aus', () => {
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss} actions={<button>Rückgängig</button>}>
        Eintrag gelöscht.
      </Toast>,
    );
    act(() => void vi.advanceTimersByTime(TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('reine Info: kürzer', () => {
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Gespeichert.</Toast>);
    act(() => void vi.advanceTimersByTime(TOAST_INFO_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(TOAST_INFO_MS).toBeLessThan(TOAST_MS);
  });

  it('solange der Fokus darin ist, läuft die Zeit nicht (WCAG 2.2.1)', () => {
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss} actions={<button>Rückgängig</button>}>
        Eintrag gelöscht.
      </Toast>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Rückgängig' }));
    act(() => void vi.advanceTimersByTime(TOAST_MS * 3));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole('button', { name: 'Rückgängig' }));
    act(() => void vi.advanceTimersByTime(TOAST_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('ohne onDismiss bleibt er stehen', () => {
    render(<Toast>Neue Version.</Toast>);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status')).toHaveTextContent('Neue Version.');
  });
});
