import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

import { capacitorHaptics } from './capacitorHaptics';
import { NO_HAPTICS } from '../ports/haptics';

describe('capacitorHaptics', () => {
  it('im Browser keine Vibration und kein Laden des Plugins', () => {
    const h = capacitorHaptics();
    expect(h).toBe(NO_HAPTICS);
    expect(h.available).toBe(false);
    expect(() => h.success()).not.toThrow();
  });
});
