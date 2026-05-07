# Mobile Operational Runbook

Operational procedures for the gustri mobile app. Read this before deploying
schema changes or hotfixes that touch mobile clients.

---

## Force-update gate (`app_versions`)

The mobile app evaluates `public.get_app_version(p_platform)` on every cold
start. Two levers:

| Column                  | Effect when changed                                                |
| ----------------------- | ------------------------------------------------------------------ |
| `min_supported_version` | Binaries below this render the **Force Update** screen and exit.   |
| `maintenance_mode`      | When `true`, all clients render the **Maintenance** screen.        |
| `maintenance_message`   | Optional copy shown under the maintenance title.                   |

The gate **fails open** — if Supabase is unreachable or the response is
malformed, users are let into the app. This is deliberate: a transient backend
hiccup should not lock out the entire fleet.

### Procedure: ship a non-backwards-compatible migration

A non-backwards-compatible migration is one that older binaries cannot read or
write through (renamed columns, removed enum values, new `NOT NULL` columns,
RPC signature changes, etc.).

1. **Land the client-side fix** in mobile (`main`). Bump
   `apps/mobile/app.json` `expo.version` (e.g. `1.0.4` → `1.0.5`).
2. **Ship a build** through EAS production. Wait until the build is approved
   in the store track (or use the OTA channel if the change is JS-only and
   compatible with the existing native runtime — see
   [C1 — expo-updates](#ota-updates) below).
3. **Wait for OTA propagation** (≈5 min for users with the app foregrounded;
   up to next cold start otherwise).
4. **Apply the migration** to production Supabase.
5. **Bump the gate** in the same window:
   ```sql
   UPDATE public.app_versions
   SET min_supported_version = '1.0.5', latest_version = '1.0.5'
   WHERE platform IN ('ios', 'android');
   ```
   Any binary on `<1.0.5` will hit the force-update screen on next cold start
   instead of making schema-incompatible reads.

### Procedure: emergency maintenance hold

If a backend incident requires taking all clients offline (e.g. corrupt cache
needs purging, write path is unsafe):

```sql
UPDATE public.app_versions
SET maintenance_mode    = true,
    maintenance_message = 'We are restoring service. Estimated 15 minutes.'
WHERE platform IN ('ios', 'android');
```

To lift:

```sql
UPDATE public.app_versions
SET maintenance_mode = false, maintenance_message = NULL
WHERE platform IN ('ios', 'android');
```

Maintenance mode kicks in on the **next cold start** for each client — it does
not interrupt sessions already in progress. Plan the timing accordingly.

---

## OTA updates (`expo-updates`)

Production binaries run on the `production` EAS update channel and check for
updates on every launch (`checkAutomatically: ON_LOAD`).

- **JS-only change**: ships via `eas update --channel production --auto`. The
  CI job `publish-ota` (in `.github/workflows/build-mobile.yml`) runs this on
  every push to `main`. Manual override is the same command from
  `apps/mobile/`.
- **Native dep change** (e.g. bumping `expo-notifications`, adding a config
  plugin): the `fingerprint` runtime policy detects a new native fingerprint,
  the OTA manifest is filed under a fresh runtimeVersion, and existing
  installs **do not** receive it as an OTA — they need a store update. This
  is the desired safety behavior.

If an OTA breaks a client, roll back via:

```bash
cd apps/mobile
eas update:rollback --channel production
```

Sentry should fire under the `ota-update` tag if the boot-time check itself
fails — that path is fail-open by design.

---

## Sentry source maps

Source map upload is wired through the `@sentry/react-native/expo` config
plugin. Org + project are pinned in `apps/mobile/app.json` and `.sentryclirc`;
the auth token is provisioned as an EAS secret:

```bash
cd apps/mobile
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```

The `SENTRY_DISABLE_AUTO_UPLOAD=false` env in `eas.json` (production profile)
ensures the upload step is not skipped on EAS builds.

The release name embedded in `Sentry.init` is
`gustri-mobile@<version>+<runtimeVersion>`, with `dist` set to the iOS
`buildNumber` or Android `versionCode`. Stack traces in Sentry should be
fully symbolicated against the matching uploaded artifact bundle.

If a crash arrives unsymbolicated (`f`/`g` frames):

1. Check Sentry → Settings → Projects → gustri-mobile → Source Maps. The
   release for that crash should have a matching artifact bundle.
2. If missing, the EAS build that produced that binary did not have
   `SENTRY_AUTH_TOKEN`. Verify with `eas secret:list` and re-run the build.

---

## Audible-alert constraint: keep the app foregrounded during shift (Android)

**TL;DR — staff using Android phones must keep the gustri app open and the
screen on (or under do-not-disturb-priority) during a shift to hear new-order
sounds reliably.** This is intentional, not a bug; the alternative ships
foreground-service requirements that add Play Store review friction without
clear staff benefit.

### What we ship

The notification handler explicitly disables in-app sound for backgrounded
delivery (`shouldPlayInBackground: false` in
[apps/mobile/src/lib/notifications.ts](src/lib/notifications.ts)). When the
app is foreground, every order arrival fires:

- A coalesced sound (≤ 1 buzz / 300 ms) via
  [sound.ts](src/lib/sound.ts).
- A haptic via [haptics.ts](src/lib/haptics.ts).
- A heads-up local notification on the `MAX`-importance channel.

When the app is backgrounded or the screen is locked, sound delivery falls
to **OS-level Expo Push routing through APNs / FCM**:

- **iOS:** `aps.sound = 'default'` plays once briefly. Lock-screen banner
  remains visible until dismissed.
- **Android 12+:** FCM-delivered notification plays the channel sound *if
  the OS hasn't aggressively killed the process*. Doze, App Standby Buckets,
  and OEM battery savers (Xiaomi, Huawei, Samsung) routinely silence
  background pushes after ≈10 minutes of inactivity.

### Operational guidance for restaurant ops

- Hand each shift-using device to staff with the app **foregrounded** and
  the screen kept awake (the `usesCleartextTraffic`-free in-app session
  already disables the OS auto-lock when the orders screen is active — see
  the `keepAwakeOn` calls in `OrdersListScreen` / `KitchenDisplayScreen`).
- For shared tablets in the kitchen, plug into power and disable the OEM
  battery-saver. Stock Android works without intervention; OEM-skinned
  Android needs the per-app battery setting flipped to **Unrestricted**.
- If a manager reports "we missed orders for 10 minutes," the first
  diagnostic is "was the app foregrounded?" before reaching for the
  realtime / push logs.

### When to revisit

Add an `expo-task-manager` foreground service (visible persistent
notification, "gustri is listening for orders") if EITHER:

1. Multiple ops complaints document missed-order incidents traced to
   backgrounded Android, or
2. A tenant explicitly contracts for background-resilient alerts (e.g.
   24/7 dark kitchen with the device locked in a drawer).

Foreground services trigger Play Store policy review under the
`FOREGROUND_SERVICE_DATA_SYNC` permission (Android 14+); ship in a
dedicated PR with the policy declaration and a screenshot of the
persistent notification UI.

### Why we don't ship a foreground service today

- Most tenants run the app on a dedicated kitchen tablet plugged into
  power with the screen always on — the failure mode this would fix
  doesn't occur in practice for them.
- Adding a foreground service adds a permanent system-tray notification
  that can't be dismissed, which is visually noisy for staff who keep the
  device foregrounded anyway.
- The Play Store review path for `FOREGROUND_SERVICE_DATA_SYNC` is a one-
  way valve — once required, every future submission needs the policy
  attestation. Not worth paying for hypothetical demand.
