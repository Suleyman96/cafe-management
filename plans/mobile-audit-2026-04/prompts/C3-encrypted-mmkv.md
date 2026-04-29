# C3 — Encrypted MMKV + clean unmount on logout

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The mobile app persists the entire TanStack Query cache to MMKV. MMKV is **not encrypted by default** — pulling `/data/data/<bundle>/files/mmkv/` via `adb` reveals orders, customer phones, and table maps in plaintext. Additionally, on tenant switch, screens can render the previous tenant's cached data for a frame before `cleanupClientState()` finishes. Read [plans/mobile-audit-2026-04/01-CRITICAL.md](../01-CRITICAL.md) section C3.

## Implementation steps

1. **Generate / read a per-device encryption key**
   - New file `apps/mobile/src/lib/storage-key.ts`:
     - Exports `getOrCreateMmkvEncryptionKey(): Promise<string>`.
     - Uses `expo-secure-store` (already a dep). Key: `gustri.mmkv-key`. Value: 32 random bytes hex-encoded, generated with `expo-crypto`'s `getRandomBytesAsync(32)`.
     - On Android use `requireAuthentication: false` (we encrypt for at-rest, not auth). On iOS use `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

2. **Wire MMKV with the key**
   - Update [apps/mobile/src/lib/query-persister.ts](../../../apps/mobile/src/lib/query-persister.ts):
     - Replace the unencrypted `new MMKV(...)` with one that takes `{ id: 'gustri-query-cache', encryptionKey }`.
     - Move MMKV init into an exported async function `initEncryptedMmkv()` that resolves once the key is ready.
   - Mirror the same pattern for any other MMKV consumer (push-token-sync cache, session-stamp from C2).

3. **App boot ordering**
   - In [App.tsx](../../../apps/mobile/App.tsx), before mounting `PersistQueryClientProvider`, await `initEncryptedMmkv()` in addition to the existing `migrateAsyncStorageToMMKV()` gate.
   - Show the existing loader while waiting.

4. **Migrate / discard pre-existing unencrypted caches**
   - On first launch under the new build, MMKV will fail to decrypt the old (unencrypted) bundle. Catch the error and call `asyncStoragePersister.removeClient()` + clear the MMKV instance. This is acceptable — paused mutations will be lost only on the very first upgrade, and we control the rollout.
   - Alternative if data loss matters: read the old unencrypted MMKV via a separate handle, copy keys we want to retain, then drop it. Document the decision in the PR.

5. **Make logout drain fully and block the navigator**
   - This overlaps with C2 step 4 — coordinate. The drain steps from C2 must include `await persister.removeClient()` *and* clear the encrypted MMKV instance keys. The navigator must await before flipping the auth state.

6. **Tests**
   - Unit test for `storage-key.ts`: round-trip the key; ensure `getOrCreate` is idempotent.
   - Manual verification in the PR description:
     - `adb pull /data/data/<bundle>/files/mmkv` on Android, attempt to read with stock MMKV (no key) → fails.
     - Logout → re-login as a different tenant → no flash of the prior tenant's orders (record a screen video; assert via maestro snapshots if practical).

## Acceptance criteria

- [ ] MMKV encryption key is generated once per install and stored in Keychain/Keystore.
- [ ] `query-persister.ts` MMKV instance is encrypted.
- [ ] App boot awaits encryption-key readiness before mounting the persister.
- [ ] Logout-then-login (different tenant) renders zero frames of prior data; `cleanupClientState` is awaited.
- [ ] `pnpm check`, `pnpm type-check`, and `pnpm test` pass.

## Out of scope

- Encrypting Sentry breadcrumbs (handled in M9).
- iOS/Android backup encryption beyond Keychain/Keystore semantics.
