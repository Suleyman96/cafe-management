# Maestro flows (mobile UI smoke tests)

[Maestro](https://maestro.mobile.dev) flows that drive the **real app** on a
simulator/emulator and screenshot it — the runtime check that unit tests and
type-checks can't give you.

## Flows

| File | What it does |
|---|---|
| `drawer-smoke.yaml` | Logs in as the seed admin, then visits every drawer destination (Delivery, Takeout, Tasks, Feedback, Stock, Waste, Expenses, Staff, Schedules, Cafe Settings) and screenshots each. Confirms every per-stack `withErrorBoundary`-wrapped screen actually renders. |
| `visit-screen.yaml` | Reusable subflow: open drawer → tap a destination → screenshot. |

Screenshots are written under the Maestro run dir (`~/.maestro/tests/<timestamp>/`)
with the `NAME`s from the flow (`00-home`, `01-delivery`, …).

## Prerequisites

1. **Maestro + a JRE.** `curl -Ls https://get.maestro.mobile.dev | bash`
   (needs Java 11+ on `PATH` — e.g. `brew install openjdk`).
2. **A backend with the seed user.** The flow signs in as
   `admin@test.com` / `test1234`. Locally: `pnpm db:reset` seeds it; point the
   app at that Supabase. (The admin role sees the Main/Management/Admin sections;
   `Reports` is owner-only and intentionally omitted — run with an owner account
   to include it.)
3. **The app installed and runnable** on a booted device:
   - **Recommended: an EAS dev build** (`eas build --profile development
     --platform ios`) — the native modules initialize correctly there.
   - A local dev build (`expo run:ios` / `expo run:android`) also works **if**
     your native toolchain is healthy (see caveat below). For a Debug build,
     **Metro must be running** (`pnpm --filter @gustri/mobile start`), with the
     Supabase env pointed at your seeded backend, e.g.:
     ```
     EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
     EXPO_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key> \
       pnpm --filter @gustri/mobile start
     ```
     (the iOS simulator reaches the host's `127.0.0.1`).

## Run

```bash
maestro test apps/mobile/.maestro/drawer-smoke.yaml
# override creds (e.g. an owner account):
maestro test -e EMAIL=owner@test.com -e PASSWORD=... apps/mobile/.maestro/drawer-smoke.yaml
```

## Caveat (hand-rolled local iOS builds)

On a bespoke local `xcodebuild` of this app under a brand-new Xcode + the React
Native New Architecture, `react-native-safe-area-context` may fail to provide
window metrics, so authenticated screens redbox with *"No safe area value
available"* before this flow can screenshot them. That's a native-module/build
artifact, **not** an app bug — it does not reproduce on a proper **EAS dev
build**, which is the recommended target for these flows. The login portion of
the flow (and the login screenshot) works regardless.
