import sql from '../../../../supabase/migrations/20261126090000_community_rules.sql?raw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_RULES,
  acceptRules,
  acceptedVersion,
  knownRules,
  rememberRules,
  resetRulesCache,
  rulesAccepted,
} from './rulesConsent';

describe('Regeln auf dem Gerät (RUL-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetRulesCache();
  });

  it('eingebaute Fassung ist wortgleich mit Fassung 1 auf dem Server', () => {
    expect(sql).toContain(`'${BUILTIN_RULES.intro}'`);
    for (const item of BUILTIN_RULES.items) expect(sql).toContain(`'${item}'`);
  });

  it('merkt neuere Fassungen, ältere nicht; Zustimmung je Fassung', () => {
    expect(knownRules().version).toBe(1);
    rememberRules({ ...BUILTIN_RULES, version: 2, items: ['neu'] });
    resetRulesCache();
    expect(knownRules()).toMatchObject({ version: 2, items: ['neu'] });
    rememberRules({ ...BUILTIN_RULES, version: 1 });
    expect(knownRules().version).toBe(2);
    expect(rulesAccepted()).toBe(false);
    acceptRules(1);
    expect(rulesAccepted(1)).toBe(true);
    expect(rulesAccepted()).toBe(false);
    acceptRules(2);
    acceptRules(1);
    expect(acceptedVersion()).toBe(2);
    expect(rulesAccepted()).toBe(true);
  });
});
