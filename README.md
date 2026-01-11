# Café İdarə - Restaurant Management System

A comprehensive restaurant management system built with modern web technologies, featuring real-time order management, table tracking, and multi-platform support.

## 🏗️ Architecture

This is a Turborepo monorepo containing:

### Apps
- **`staff-web`** - Staff management dashboard (Next.js 14)
- **`customer-web`** - Customer ordering interface
- **`mobile`** - React Native mobile app

### Packages
- **`@cafe-idare/core`** - Shared business logic, utilities, and constants
- **`@cafe-idare/database`** - Database types and schemas
- **`@cafe-idare/api-client`** - Type-safe API client with runtime validation
- **`@cafe-idare/ui`** - Shared React components

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Supabase account

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/staff-web/.env.example apps/staff-web/.env.local
# Add your Supabase credentials
```

### Development

```bash
# Run all apps
pnpm dev

# Run specific app
pnpm dev --filter=@cafe-idare/staff-web

# Build all packages
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: Zustand, TanStack Query
- **Backend**: Supabase (PostgreSQL, Realtime, Auth)
- **Build System**: Turborepo, tsup
- **Package Manager**: pnpm

## 📱 Features

### Staff Dashboard
- Real-time order management
- Table status tracking
- Menu item management
- Payment processing
- Staff coordination
- Analytics and reporting

### Customer Interface
- QR code table scanning
- Digital menu browsing
- Order placement
- Real-time order tracking
- Feedback system

## 🔒 Type Safety

This project uses TypeScript strict mode with:
- Comprehensive type definitions
- Runtime validation for API responses
- Type-safe database queries
- No `any` types in the codebase

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
