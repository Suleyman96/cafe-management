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
- Git (required for Windows)

### Installation

#### macOS / Linux

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/staff-web/.env.example apps/staff-web/.env.local
# Add your Supabase credentials
```

#### Windows

**Option 1: Using PowerShell (Recommended)**

```powershell
# Install dependencies
pnpm install

# Set up environment variables
Copy-Item apps/staff-web/.env.example apps/staff-web/.env.local
# Add your Supabase credentials
```

**Option 2: Using Git Bash**

If you have Git installed, you can use Git Bash which supports Unix commands:

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/staff-web/.env.example apps/staff-web/.env.local
# Add your Supabase credentials
```

**Option 3: Using WSL (Windows Subsystem for Linux)**

For the best development experience on Windows, consider using WSL2:

```bash
# Follow the macOS/Linux instructions above in your WSL terminal
```

### Windows Troubleshooting

- **Node.js Installation**: Download from [nodejs.org](https://nodejs.org/) or use [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **pnpm Installation**: Run `npm install -g pnpm` or use `corepack enable` (Node.js 16.13+)
- **Long Path Issues**: If you encounter path length errors, enable long paths in Windows:
  ```powershell
  # Run as Administrator
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```
- **Script Execution Policy**: If PowerShell blocks script execution:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### Database Setup

```bash
# Start Supabase locally
supabase start

# Reset database (applies all migrations and seeds data)
supabase db reset

# Create admin user for login
pnpm db:seed-user
# Or run directly: ./scripts/create-admin-user.sh

# Combined command (reset + create user)
pnpm db:reset
```

**Default Admin Credentials:**
- Email: `admin@test.com`
- Password: `test1234`

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

## Supabase admin user create sql

INSERT INTO staff (email, full_name, role, is_active, auth_user_id)
VALUES (
  'admin@example.com',
  'Admin User', 
  'admin',
  true,
  'YOUR_AUTH_USER_UUID_HERE'
);

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
