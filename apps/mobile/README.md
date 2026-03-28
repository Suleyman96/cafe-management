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
- **Sound**: Expo AV

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

## Push Notifications

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


