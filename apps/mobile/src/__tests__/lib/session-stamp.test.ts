import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetSessionStampForTests,
  clearSessionStamp,
  initEncryptedSessionStamp,
  readSessionStamp,
  writeSessionStamp,
} from '@/lib/session-stamp';
import { __resetMmkvEncryptionKeyCacheForTests } from '@/lib/storage-key';

describe('session-stamp', () => {
  beforeEach(async () => {
    __resetSessionStampForTests();
    __resetMmkvEncryptionKeyCacheForTests();
    await initEncryptedSessionStamp();
    clearSessionStamp();
  });

  it('round-trips a written stamp', () => {
    writeSessionStamp({ tenantId: 'T_A', staffId: 'S_A' });
    expect(readSessionStamp()).toEqual({ tenantId: 'T_A', staffId: 'S_A' });
  });

  it('overwrites a previous stamp', () => {
    writeSessionStamp({ tenantId: 'T_A', staffId: 'S_A' });
    writeSessionStamp({ tenantId: 'T_B', staffId: 'S_B' });
    expect(readSessionStamp()).toEqual({ tenantId: 'T_B', staffId: 'S_B' });
  });

  it('returns null when no stamp is present', () => {
    clearSessionStamp();
    expect(readSessionStamp()).toBeNull();
  });

  it('clear is idempotent', () => {
    writeSessionStamp({ tenantId: 'T_A', staffId: 'S_A' });
    clearSessionStamp();
    clearSessionStamp();
    expect(readSessionStamp()).toBeNull();
  });
});
