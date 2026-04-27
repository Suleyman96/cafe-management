# Gustri - Mobile App

React Native mobile application for staff management (Waiter, Admin, Kitchen).

## Tech Stack

- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: Zustand + TanStack React Query
- **UI Library**: React Native Paper
- **Real-time**: Supabase Realtime
- **Notifications**: Expo Notifications
- **Sound**: Expo Audio

## Features

### Waiter Features
- View table status (Free/Occupied/Reserved)
- Manage orders and update status
- Receive notifications for new orders and waiter calls
- View order history

### Admin Features
- All waiter features
- Menu and price management
- Staff management
- Sales reports and analytics

### Kitchen Features
- Grid view of active orders
- Color-coded order statuses
- Item notes prominently displayed
- Sound/vibration alerts for new orders
- Read-only access

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- Physical device for push notifications

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your Supabase credentials
```

### Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_NAME="Gustri"
```

#### EAS-managed secrets

Build-time secrets are scoped per EAS environment (`development` / `preview` /
`production`) — they live in EAS, not in `.env`. `eas.json` binds each build
profile to its environment, so a `preview` build can never inherit production
secrets, and `app.config.ts` throws at config resolution if a required secret
is missing for production/preview builds.

Provision once per environment:

```bash
cd apps/mobile

# Production
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <prod-url>
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <prod-key>
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value <prod-dsn>

# Preview / staging
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value <staging-url>
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <staging-key>

# Development
eas env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value <dev-url>
```

Sync the development environment into a local `.env` for `expo start`:

```bash
eas env:pull --environment development
```

Verify what's stored:

```bash
eas env:list --environment production
```

### Development

```bash
# Start Expo dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Project Structure

```
src/
├── navigation/           # Navigation setup
│   ├── RootNavigator.tsx
│   ├── AuthStack.tsx
│   └── MainTabs.tsx
├── screens/             # Screen components
│   ├── auth/
│   │   └── LoginScreen.tsx
│   ├── waiter/
│   │   ├── TablesScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── admin/
│   │   ├── MenuManagementScreen.tsx
│   │   ├── StaffManagementScreen.tsx
│   │   └── ReportsScreen.tsx
│   └── kitchen/
│       └── KitchenDisplayScreen.tsx
├── components/          # Reusable components
│   ├── orders/
│   ├── tables/
│   └── ui/
├── hooks/               # React Query hooks
│   ├── use-orders.ts
│   ├── use-tables.ts
│   └── use-waiter-calls.ts
├── store/               # Zustand stores
│   └── auth-store.ts
├── lib/                 # Utilities
│   ├── supabase.ts
│   ├── auth.ts
│   ├── notifications.ts
│   └── sound.ts
└── types/               # TypeScript types
    ├── database.ts
    └── index.ts
```

## Key Screens

### 1. Login Screen
- Email/password authentication
- Role-based routing after login

### 2. Tables Screen (Waiter/Admin)
- Grid view of all tables
- Status indicators (Free/Occupied)
- Table detail with current orders

### 3. Orders Screen (Waiter/Admin)
- List of active orders
- Filter by status (New/Preparing/Ready)
- Order detail with items and notes

### 4. Kitchen Display (Kitchen)
- Grid view of active orders
- Color-coded cards
- Large, readable text
- Auto-refresh

### 5. Menu Management (Admin)
- Add/edit/delete menu items
- Update prices and availability
- Category management

### 6. Staff Management (Admin)
- Add/edit/deactivate staff
- Assign roles
- View staff performance

### 7. Reports (Admin)
- Daily/weekly/monthly sales
- Popular items
- Staff performance metrics

## Real-Time Features

- New order notifications with sound
- Waiter call alerts
- Order status updates
- Live kitchen display updates

## Notifications & Sound

The app delivers new-order / waiter-call alerts through two distinct paths
depending on whether the app is in the foreground:

- **Foreground** (`useRealtimeSync` callback in `lib/sound.ts`): a Supabase
  Realtime INSERT triggers `playNewOrderSound()` / `playWaiterCallSound()`
  (an in-app `expo-audio` player) plus a local notification banner via
  `expo-notifications`. When realtime is degraded (≥ `MAX_RETRIES`
  consecutive failures), the 2-min fallback poll diffs the order list and
  plays the sound for newly-arrived rows so the kitchen still gets audible
  alerts.
- **Background / killed**: in-app sounds intentionally do NOT fire
  (`shouldPlayInBackground: false` in `setupSounds()`). The OS plays a
  notification sound via the configured Android `default` channel
  (`importance: MAX`, `vibrationPattern: [0, 250, 250, 250]`) — but ONLY
  if the server delivered a push notification. The push token is stored on
  the `staff` row by `usePushTokenSync`, but the server-side sender that
  fires on `orders` INSERT is tracked separately under
  `plans/prompts/remaining-03-push-webhooks.md`. Until that pipeline ships,
  a backgrounded device will not hear about new orders.

If you change the foreground/background split (e.g. enable
`shouldPlayInBackground: true`), update `lib/sound.ts` AND this section, and
verify the server-side push pipeline still owns the background path.

### Push notifications

Requires physical device for testing:

```bash
# Build for device
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Build & Deploy

### EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

## Testing

```bash
# Run type checking
npm run type-check

# Run linter
npm run lint
```

## Color Coding

### Order Status
- 🔴 New: Red (urgent)
- 🟡 Preparing: Orange (in progress)
- 🟢 Ready: Green (complete)
- ⚪ Served: Gray (delivered)

### Table Status
- 🟢 Free: Green
- 🔴 Occupied: Red
- 🟡 Reserved: Yellow

## Offline Support

- Orders are queued when offline
- Automatic retry when connection restored
- Cached data for menu and tables

## Performance

- Optimistic UI updates
- Image caching
- Lazy loading for lists
- Efficient real-time subscriptions

## Contributing

See main project README for contribution guidelines.

## License

Proprietary - All rights reserved


