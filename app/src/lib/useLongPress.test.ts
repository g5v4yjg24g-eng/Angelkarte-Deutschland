import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, useLongPress } from './useLongPress';

const down = (x = 10, y = 10, extra: object = {}) =>
  ({ isPrimary: true, pointerType: 'touch', button: 0, clientX: x, clientY: y, ...extra }) as never;

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('löst nach der Haltezeit aus', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    act(() => result.current.onPointerDown(down()));
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS - 10));
    expect(fn).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(20));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('Loslassen vorher löst nichts aus', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    act(() => result.current.onPointerDown(down()));
    act(() => result.current.onPointerUp());
    act(() => void vi.advanceTimersByTime(1000));
    expect(fn).not.toHaveBeenCalled();
  });
  it('Wischen (Bewegung über 10 px) bricht ab, kleines Zittern nicht', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useLongPress(fn));
    act(() => result.current.onPointerDown(down()));
    act(() => result.current.onPointerMove({ clientX: 14, clientY: 12 } as never));
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => result.current.onPointerDown(down()));
    act(() => result.current.onPointerMove({ clientX: 40, clientY: 10 } as never));
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('nach dem Auslösen wird das Antippen einmal unterdrückt', () => {
    const { result } = renderHook(() => useLongPress(() => undefined));
    act(() => result.current.onPointerDown(down()));
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    result.current.onClickCapture(e as never);
    expect(e.preventDefault).toHaveBeenCalled();
    const e2 = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    result.current.onClickCapture(e2 as never);
    expect(e2.preventDefault).not.toHaveBeenCalled();
  });
  it('ausgeschaltet oder rechte Maustaste: nichts', () => {
    const fn = vi.fn();
    const off = renderHook(() => useLongPress(fn, false));
    act(() => off.result.current.onPointerDown(down()));
    const on = renderHook(() => useLongPress(fn));
    act(() => on.result.current.onPointerDown(down(10, 10, { pointerType: 'mouse', button: 2 })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(fn).not.toHaveBeenCalled();
  });
});
