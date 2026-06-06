/**
 * `isAuthorizedCron` — shared-secret auth for the data-retention scheduler.
 *
 * Guards the cron path on `/api/v1/admin/retention`: a valid `x-cron-secret`
 * lets the GitHub Actions cron run retention without a user session, while an
 * unset `CRON_SECRET` keeps the endpoint admin-only (safe default).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAuthorizedCron } from '@/lib/api/verify-cron-secret';

function req(cronHeader?: string) {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-cron-secret' ? (cronHeader ?? null) : null),
    },
  };
}

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe('isAuthorizedCron', () => {
  describe('safe default (CRON_SECRET unset)', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    it('returns false even when a header is present', () => {
      expect(isAuthorizedCron(req('anything'))).toBe(false);
    });

    it('returns false with no header', () => {
      expect(isAuthorizedCron(req())).toBe(false);
    });
  });

  describe('CRON_SECRET configured', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'super-secret-value-123';
    });

    it('authorizes a request whose header matches exactly', () => {
      expect(isAuthorizedCron(req('super-secret-value-123'))).toBe(true);
    });

    it('rejects a mismatched secret', () => {
      expect(isAuthorizedCron(req('wrong-secret'))).toBe(false);
    });

    it('rejects a missing header', () => {
      expect(isAuthorizedCron(req())).toBe(false);
    });

    it('rejects an empty header', () => {
      expect(isAuthorizedCron(req(''))).toBe(false);
    });

    it('rejects a value that is a prefix of the secret (length guard)', () => {
      expect(isAuthorizedCron(req('super-secret-value-12'))).toBe(false);
    });

    it('rejects a value longer than the secret', () => {
      expect(isAuthorizedCron(req('super-secret-value-1234'))).toBe(false);
    });
  });
});
