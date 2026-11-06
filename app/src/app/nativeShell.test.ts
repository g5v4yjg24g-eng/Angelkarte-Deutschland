import { afterEach, describe, expect, it, vi } from 'vitest';

const native = { value: false };
const listeners: Record<string, () => void> = {};
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value, getPlatform: () => (native.value ? 'ios' : 'web') },
}));
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
      return Promise.resolve({ remove: () => undefined });
    },
  },
}));

import { setupNativeShell } from './nativeShell';

const VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

function freshDoc() {
  const doc = document.implementation.createHTMLDocument('t');
  const meta = doc.createElement('meta');
  meta.name = 'viewport';
  meta.content = VIEWPORT;
  doc.head.append(meta);
  return doc;
}

afterEach(() => {
  native.value = false;
});

describe('setupNativeShell', () => {
  it('ändert im Browser nichts (Web-App bleibt zoombar und markierbar)', () => {
    const doc = freshDoc();
    setupNativeShell(doc);
    expect(doc.documentElement.dataset.native).toBeUndefined();
    expect(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(VIEWPORT);
  });

  it('in der iPhone-App: Kennzeichen, kein Zoomen der Oberfläche, Tastatur-Kennzeichen', async () => {
    native.value = true;
    const doc = freshDoc();
    setupNativeShell(doc);
    expect(doc.documentElement.dataset.native).toBe('ios');
    const content = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
    expect(content).toContain('user-scalable=no');
    expect(content).toContain('viewport-fit=cover');
    await vi.waitFor(() => expect(listeners.keyboardWillShow).toBeDefined());
    listeners.keyboardWillShow?.();
    expect(doc.documentElement.dataset.keyboard).toBe('open');
    listeners.keyboardWillHide?.();
    expect(doc.documentElement.dataset.keyboard).toBeUndefined();
  });
});
