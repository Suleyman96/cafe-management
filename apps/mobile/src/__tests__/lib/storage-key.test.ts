import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMmkvEncryptionKeyCacheForTests,
  getOrCreateMmkvEncryptionKey,
} from '@/lib/storage-key';

describe('storage-key', () => {
  beforeEach(() => {
    __resetMmkvEncryptionKeyCacheForTests();
    vi.mocked(SecureStore.getItemAsync).mockClear();
    vi.mocked(SecureStore.setItemAsync).mockClear();
    vi.mocked(Crypto.getRandomBytesAsync).mockClear();
    // Clear in-memory secure-store between tests so each starts fresh.
    // The mock backs onto a closed-over Map, so iterating delete keys
    // would require a reset hook — easier to mock a fresh getItemAsync
    // that returns null on first read this test.
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
  });

  it('generates and persists a 64-char hex key on first call', async () => {
    const key = await getOrCreateMmkvEncryptionKey();

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'gustri.mmkv-key',
      key,
      expect.objectContaining({ requireAuthentication: false }),
    );
  });

  it('returns the existing key when SecureStore already has one', async () => {
    const existing = 'a'.repeat(64);
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(existing);

    const key = await getOrCreateMmkvEncryptionKey();

    expect(key).toBe(existing);
    expect(Crypto.getRandomBytesAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('is idempotent across calls within a process — single SecureStore read', async () => {
    const a = await getOrCreateMmkvEncryptionKey();
    const b = await getOrCreateMmkvEncryptionKey();
    const c = await getOrCreateMmkvEncryptionKey();

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the in-memory cache on read failure so a retry can re-attempt', async () => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(getOrCreateMmkvEncryptionKey()).rejects.toThrow('keystore unavailable');

    // Subsequent call must reach SecureStore again, not return the failed promise.
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('b'.repeat(64));
    const key = await getOrCreateMmkvEncryptionKey();
    expect(key).toBe('b'.repeat(64));
  });
});
