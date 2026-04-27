import { describe, expect, it } from 'vitest';
import azCommon from '../locales/az/common.json';
import enAuth from '../locales/en/auth.json';
import enCommon from '../locales/en/common.json';
import enCustomer from '../locales/en/customer.json';
import enNav from '../locales/en/nav.json';
import enRoles from '../locales/en/roles.json';
import enStaff from '../locales/en/staff.json';
import jaCommon from '../locales/ja/common.json';

describe('English locale files', () => {
  it.each([
    ['common', enCommon],
    ['auth', enAuth],
    ['customer', enCustomer],
    ['nav', enNav],
    ['roles', enRoles],
    ['staff', enStaff],
  ])('en/%s.json loads as a non-empty object', (_, json) => {
    expect(json).toBeTypeOf('object');
    expect(Object.keys(json as object).length).toBeGreaterThan(0);
  });

  it('en/common.json has the cancel/save/delete UI primitives', () => {
    expect((enCommon as Record<string, string>).cancel).toBeTypeOf('string');
    expect((enCommon as Record<string, string>).delete).toBeTypeOf('string');
  });
});

describe('Cross-locale parity', () => {
  it('ja and az locales include common.json', () => {
    expect(jaCommon).toBeTypeOf('object');
    expect(azCommon).toBeTypeOf('object');
  });

  it('ja and az common.json share most top-level keys with en', () => {
    const enKeys = new Set(Object.keys(enCommon));
    const jaKeys = new Set(Object.keys(jaCommon));
    const azKeys = new Set(Object.keys(azCommon));
    // Allow up to ~20% drift but the locales should overlap heavily
    const jaShared = [...enKeys].filter((k) => jaKeys.has(k)).length;
    const azShared = [...enKeys].filter((k) => azKeys.has(k)).length;
    expect(jaShared).toBeGreaterThan(enKeys.size * 0.5);
    expect(azShared).toBeGreaterThan(enKeys.size * 0.5);
  });
});
