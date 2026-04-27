# Deep-link & Notification QA Matrix

A regression matrix for the routing layer that handles entry-points outside
normal in-app navigation: notification taps, custom-scheme deep links
(`gustri://`), and universal links (`https://app.gustri.com/...`).

## Why this matrix exists

Three independent inputs change behavior:

1. **Source** — push notification, custom-scheme deep link, or universal link
2. **App state** — cold start (process not running) vs warm (process running, may be backgrounded)
3. **Auth state** — logged in vs logged out

That's 3 × 2 × 2 = 12 cells. Run all 12 once per release that touches:

- `apps/mobile/App.tsx` (the boot effects)
- `apps/mobile/src/lib/navigation-ref.ts` (notification dispatcher)
- `apps/mobile/src/navigation/linking-config.ts` (route map)
- `apps/mobile/src/navigation/RootNavigator.tsx` (post-login intent replay)
- `apps/mobile/src/store/pending-intent-store.ts`

## Test fixtures

- **Notification payloads**:
  - `{ type: 'new_order', orderId: '<uuid>' }` → expected: `OrdersTab → OrderDetail`
  - `{ type: 'waiter_call', tableId: '<uuid>' }` → expected: `TablesTab → TableDetail`
- **Deep-link URLs**:
  - `gustri://orders/<uuid>` → expected: `OrdersTab → OrderDetail`
  - `gustri://tables/<uuid>` → expected: `TablesTab → TableDetail`
- **Universal-link URLs**:
  - `https://app.gustri.com/orders/<uuid>` → expected: `OrdersTab → OrderDetail`
  - `https://app.gustri.com/tables/<uuid>` → expected: `TablesTab → TableDetail`

## Matrix

| # | Source | App state | Auth | Expected behavior |
|---|--------|-----------|------|-------------------|
| 1 | Notification | Cold | Logged in | App boots → routes to target screen |
| 2 | Notification | Cold | Logged out | App boots → Login screen → after login, target screen opens |
| 3 | Notification | Warm | Logged in | Target screen opens immediately |
| 4 | Notification | Warm | Logged out | Pending — opens after login |
| 5 | Custom-scheme | Cold | Logged in | App boots → routes to target screen via NavigationContainer linking |
| 6 | Custom-scheme | Cold | Logged out | App boots → Login → after login, `Linking.openURL` re-emits and routes |
| 7 | Custom-scheme | Warm | Logged in | NavigationContainer handles → target screen |
| 8 | Custom-scheme | Warm | Logged out | Pending — replays via `Linking.openURL` after login |
| 9 | Universal-link | Cold | Logged in | OS hands URL to app → routes to target screen |
| 10 | Universal-link | Cold | Logged out | App boots → Login → after login, replays |
| 11 | Universal-link | Warm | Logged in | OS hands URL → target screen |
| 12 | Universal-link | Warm | Logged out | Pending — replays after login |

## How to test

### Notifications (cells 1–4)

```bash
# Trigger a test push from the Expo notifications API or send via Sentry alerts.
# Use a curl against the Expo push endpoint targeting the device's expo push token.
```

For cold-start (cells 1, 2): force-stop the app, then tap the notification from the system tray.
For warm (cells 3, 4): keep the app foregrounded or backgrounded, then deliver the push.

### Custom-scheme deep links (cells 5–8)

iOS Simulator:
```bash
xcrun simctl openurl booted "gustri://orders/<uuid>"
```

Android emulator:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "gustri://orders/<uuid>"
```

For cold-start (cells 5, 6): force-stop first.

### Universal links (cells 9–12)

Requires:
- iOS: `apple-app-site-association` served at `https://app.gustri.com/.well-known/apple-app-site-association`
- Android: `assetlinks.json` served at `https://app.gustri.com/.well-known/assetlinks.json`
- App built with the matching team ID / SHA-256 fingerprints

Test by tapping the URL from Notes, Mail, or Messages — Safari/Chrome will short-circuit to the app.

For cold-start (cells 9, 10): force-stop first.

## Sign-off

A release that touches the deep-link path is not ready to ship until all 12 cells pass on at least:

- 1× iOS device (latest stable)
- 1× Android device (latest stable)

Record the run in the PR description with date + tester initials.
