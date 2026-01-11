# Café İdarə Architecture & Configuration Plan

## 🎯 Overview

This document outlines the recommended architecture and configuration for the Café İdarə project to prevent compile/type errors and ensure smooth development.

## 🏗️ Recommended Architecture: Turborepo Monorepo

### Why Turborepo?
- **Incremental builds**: Only rebuilds what changed
- **Parallel execution**: Runs tasks in parallel across packages
- **Remote caching**: Share build artifacts across team
- **Zero-config**: Works out of the box with Next.js
- **Type safety**: Excellent TypeScript support

### Project Structure

```
cafe-idare/
├── apps/
│   ├── customer-web/
│   ├── staff-web/
│   └── mobile/
├── packages/
│   ├── database/
│   ├── ui/
│   ├── core/
│   └── api-client/
├── services/
│   └── supabase/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 📦 Package Breakdown

### 1. `@cafe-idare/database`
**Purpose**: Single source of truth for database types and schema

```typescript
// packages/database/src/index.ts
export * from './generated/types';
export * from './schema';
export * from './enums';

// Features:
- Prisma schema (if migrating from pure Supabase types)
- Generated TypeScript types
- Zod schemas for validation
- Database constants
```

### 2. `@cafe-idare/core`
**Purpose**: Business logic, utilities, and constants

```typescript
// packages/core/src/index.ts
export * from './utils';
export * from './constants';
export * from './validators';
export * from './formatters';

// No React dependencies!
// Pure TypeScript functions
```

### 3. `@cafe-idare/ui`
**Purpose**: Shared UI components (optional, only if sharing between web apps)

```typescript
// packages/ui/src/index.ts
export * from './components';
export * from './hooks'; // UI-only hooks like useDebounce

// Uses same design system
// Shared between customer-web and staff-web
```

### 4. `@cafe-idare/api-client`
**Purpose**: Typed API client wrapper

```typescript
// packages/api-client/src/index.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/database';

export function createApiClient(url: string, key: string) {
  return createClient<Database>(url, key);
}

export * from './queries';  // Prepared queries
export * from './mutations'; // Prepared mutations
```

## 🔧 Configuration Setup

### 1. Root Configuration Files

**`turbo.json`**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

**`pnpm-workspace.yaml`**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

**Root `package.json`**:
```json
{
  "name": "cafe-idare",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "latest",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.x.x",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 2. TypeScript Configuration

**Root `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**App-specific `tsconfig.json`** (extends root):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 3. Next.js Configuration

**`next.config.js`** for apps:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: [
    "@cafe-idare/database",
    "@cafe-idare/core",
    "@cafe-idare/ui",
    "@cafe-idare/api-client"
  ],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  images: {
    domains: ["localhost", "supabase.co"],
  },
};

module.exports = nextConfig;
```

### 4. ESLint Configuration

**Root `.eslintrc.js`**:
```javascript
module.exports = {
  root: true,
  extends: ["next", "turbo", "prettier"],
  settings: {
    next: {
      rootDir: ["apps/*/", "packages/*/"],
    },
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "turbo/no-undeclared-env-vars": "off",
  },
};
```

## 🚀 Implementation Plan

### Phase 1: Setup Monorepo (Day 1)
1. Initialize Turborepo
2. Move existing apps to `apps/` directory
3. Set up pnpm workspaces
4. Configure build pipeline

### Phase 2: Extract Packages (Day 2-3)
1. Create `@cafe-idare/database` package
   - Move all type definitions
   - Set up type generation pipeline
   
2. Create `@cafe-idare/core` package
   - Move utilities and constants
   - No React dependencies

3. Create `@cafe-idare/api-client` package
   - Supabase client wrapper
   - Typed query/mutation functions

### Phase 3: Refactor Apps (Day 4-5)
1. Update imports in all apps
2. Remove duplicate code
3. Implement proper data fetching patterns
4. Add error boundaries

### Phase 4: Testing & Optimization (Day 6-7)
1. Set up testing infrastructure
2. Add E2E tests for critical paths
3. Configure CI/CD pipeline
4. Performance optimization

## 🎯 Best Practices

### 1. Data Fetching Pattern

**Don't**: Export React Query hooks from shared packages
**Do**: Keep hooks in each app, share only logic

```typescript
// ❌ Bad: In shared package
export function useOrders() {
  return useQuery({...});
}

// ✅ Good: In shared package
export async function fetchOrders(client: SupabaseClient) {
  const { data, error } = await client
    .from('orders')
    .select('*');
  return { data, error };
}

// ✅ Good: In app
import { fetchOrders } from '@cafe-idare/api-client';

export function useOrders() {
  const client = useSupabaseClient();
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => fetchOrders(client)
  });
}
```

### 2. Type Safety

```typescript
// packages/database/src/validators.ts
import { z } from 'zod';

export const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'preparing', 'ready', 'served', 'paid']),
  // ... rest of schema
});

export type Order = z.infer<typeof OrderSchema>;
```

### 3. Error Handling

```typescript
// packages/core/src/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
```

## 🛡️ Preventing Common Issues

### 1. Module Resolution
- Use TypeScript `paths` only for app-internal imports
- Use package names for cross-package imports
- Keep `node_modules` hoisting consistent with pnpm

### 2. Type Safety
- Single source of truth for types in `@cafe-idare/database`
- Use Zod for runtime validation
- Generate types from database schema

### 3. Build Performance
- Use Turborepo caching
- Implement incremental builds
- Parallelize tasks where possible

### 4. Development Experience
- Hot reload works across packages
- Type checking in real-time
- Clear error messages

## 📊 Benefits

1. **Faster Builds**: 10-50x faster with caching
2. **Type Safety**: Errors caught at compile time
3. **Code Sharing**: True code reuse without issues
4. **Independent Deployment**: Deploy apps separately
5. **Scalability**: Easy to add new apps/packages

## 🔄 Migration Steps

1. **Backup current code**
2. **Set up Turborepo structure**
3. **Move code incrementally**
4. **Test each step**
5. **Update CI/CD**

## 📚 Resources

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Next.js Monorepo Guide](https://nextjs.org/docs/advanced/monorepos)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## 🎯 Success Metrics

- Zero TypeScript errors across all packages
- Build time < 30 seconds (with cache)
- Hot reload < 1 second
- 100% type coverage
- No runtime type errors

## 🚦 Next Steps

1. Review this plan with the team
2. Set up a proof-of-concept
3. Gradually migrate existing code
4. Document patterns as you go
5. Iterate based on feedback