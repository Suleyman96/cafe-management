import { beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '../config';
import {
  errorMessageKey,
  isSentinelErrorCode,
  localizeErrorMessage,
  SENTINEL_ERROR_CODES,
} from '../error-keys';
import { DEFAULT_LANGUAGE } from '../languages';

const ENGLISH_FIXTURES = {
  payment_exceeds_remaining:
    'Payment exceeds the remaining balance. Refresh the order to see the updated total.',
  waiter_call_already_acknowledged: 'This call was just answered by another team member.',
  version_conflict: 'Another device just changed this order. Refresh and try again.',
};

const JAPANESE_FIXTURES = {
  payment_exceeds_remaining: '支払金額が残額を超えています。',
};

beforeEach(async () => {
  await initI18n({
    lng: 'en',
    namespaces: ['errors', 'common'],
    resources: {
      en: { errors: ENGLISH_FIXTURES, common: {} },
      [DEFAULT_LANGUAGE]: { errors: JAPANESE_FIXTURES, common: {} },
    },
  });
});

describe('errorMessageKey', () => {
  it('returns the code itself (flat key inside the errors namespace)', () => {
    expect(errorMessageKey('payment_exceeds_remaining')).toBe('payment_exceeds_remaining');
  });
});

describe('isSentinelErrorCode', () => {
  it('returns true for every code in SENTINEL_ERROR_CODES', () => {
    for (const code of SENTINEL_ERROR_CODES) {
      expect(isSentinelErrorCode(code)).toBe(true);
    }
  });

  it('returns false for arbitrary strings', () => {
    expect(isSentinelErrorCode('not_a_known_code')).toBe(false);
    expect(isSentinelErrorCode('Order not found: 123')).toBe(false);
    expect(isSentinelErrorCode(undefined)).toBe(false);
    expect(isSentinelErrorCode(42)).toBe(false);
  });
});

describe('localizeErrorMessage', () => {
  it('translates a known sentinel code to the active locale', () => {
    expect(localizeErrorMessage('payment_exceeds_remaining')).toBe(
      ENGLISH_FIXTURES.payment_exceeds_remaining,
    );
  });

  it('falls back when the message is empty', () => {
    expect(localizeErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(localizeErrorMessage('')).toBe('');
  });

  it('returns prose messages untouched (no false-positive translation lookup)', () => {
    const prose = 'Order not found: 123';
    expect(localizeErrorMessage(prose)).toBe(prose);
  });

  it('returns fallback for snake_case look-alike codes that have no translation', () => {
    expect(localizeErrorMessage('totally_unknown_sentinel', 'something went wrong')).toBe(
      'something went wrong',
    );
  });

  it('returns the raw code as a last resort if no fallback supplied', () => {
    expect(localizeErrorMessage('totally_unknown_sentinel')).toBe('totally_unknown_sentinel');
  });

  it('honors the active language', async () => {
    const { i18n } = await import('../config');
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
    expect(localizeErrorMessage('payment_exceeds_remaining')).toBe(
      JAPANESE_FIXTURES.payment_exceeds_remaining,
    );
    await i18n.changeLanguage('en');
  });
});

describe('locale coverage', () => {
  it.each([
    ['en'],
    ['ja'],
    ['ko'],
    ['az'],
    ['ru'],
    ['tr'],
    ['ka'],
    ['kk'],
    ['uz'],
    ['de'],
    ['fr'],
    ['es'],
    ['pt'],
    ['th'],
    ['id'],
    ['uk'],
    ['ar'],
    ['it'],
    ['fa'],
    ['el'],
  ])('%s/errors.json defines every sentinel code', async (locale) => {
    const bundle = (await import(`../locales/${locale}/errors.json`)) as {
      default: Record<string, string>;
    };
    for (const code of SENTINEL_ERROR_CODES) {
      expect(bundle.default[code], `${locale} is missing key "${code}"`).toBeTypeOf('string');
      expect(bundle.default[code]?.length, `${locale}.${code} is empty`).toBeGreaterThan(0);
    }
  });
});
