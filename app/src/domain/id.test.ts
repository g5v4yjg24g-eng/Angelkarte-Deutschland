import { afterEach, describe, expect, it } from 'vitest';
import { newId } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');

describe('newId', () => {
  afterEach(() => {
    if (original) Object.defineProperty(crypto, 'randomUUID', original);
    else delete (crypto as { randomUUID?: unknown }).randomUUID;
  });
  it('liefert UUID v4', () => expect(newId()).toMatch(UUID_V4));
  it('funktioniert ohne crypto.randomUUID (unsicherer Kontext, z. B. http://192.168.…)', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
