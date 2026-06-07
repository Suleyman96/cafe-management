import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Per-install MMKV encryption key, persisted in the OS keystore (iOS Keychain
 * / Android Keystore via expo-secure-store). Generated lazily on first launch
 * and reused thereafter so the disk-resident MMKV blob is unreadable to anyone
 * who pulls `/data/data/<bundle>/files/mmkv/` (or the iOS sandbox equivalent)
 * without also extracting the keystore entry.
 *
 * The key is 32 random bytes hex-encoded (64-char string). MMKV accepts the
 * string as-is and uses it for at-rest AES encryption.
 *
 * iOS uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` so the key isn't included in
 * iCloud Keychain / device backups — encrypted cache restored to a different
 * device wouldn't decrypt anyway, but keeping the key device-local removes
 * any chance of leaking it through backup channels.
 *
 * Android: `requireAuthentication: false` because we encrypt for at-rest
 * protection, not for re-authentication on every read.
 */

const SECURE_STORE_KEY = 'gustri.mmkv-key';

let cachedKeyPromise: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    // i < bytes.length guarantees bytes[i] is in-bounds.
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

export async function getOrCreateMmkvEncryptionKey(): Promise<string> {
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    const existing = await SecureStore.getItemAsync(SECURE_STORE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (existing) return existing;

    const random = await Crypto.getRandomBytesAsync(32);
    const hex = bytesToHex(random);
    await SecureStore.setItemAsync(SECURE_STORE_KEY, hex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      requireAuthentication: false,
    });
    return hex;
  })();

  try {
    return await cachedKeyPromise;
  } catch (err) {
    cachedKeyPromise = null;
    throw err;
  }
}

// Test-only: reset the in-memory cache so tests can exercise the read/create
// paths independently. Not used in production.
export function __resetMmkvEncryptionKeyCacheForTests(): void {
  cachedKeyPromise = null;
}
