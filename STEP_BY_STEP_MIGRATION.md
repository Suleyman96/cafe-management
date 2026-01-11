# Step-by-Step Migration to Turborepo

## 🚀 Phase 1: Preparation (30 minutes)

### 1. Backup Current Code
```bash
# Create a backup branch
git checkout -b backup/pre-turborepo
git push origin backup/pre-turborepo

# Create a new branch for migration
git checkout main
git checkout -b feature/turborepo-migration
```

### 2. Install pnpm
```bash
npm install -g pnpm@8.14.0
```

### 3. Clean Current Setup
```bash
# Remove all node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
find . -name ".next" -type d -prune -exec rm -rf '{}' +
```

## 📦 Phase 2: Restructure (1 hour)

### 1. Run Setup Script
```bash
# Make script executable
chmod +x setup-turborepo.sh

# Run the setup
./setup-turborepo.sh
```

### 2. Update App Package Names

#### Update `apps/customer-web/package.json`:
```json
{
  "name": "@cafe-idare/customer-web",
  "version": "0.1.0",
  "private": true
}
```

#### Update `apps/staff-web/package.json`:
```json
{
  "name": "@cafe-idare/staff-web",
  "version": "0.1.0",
  "private": true
}
```

### 3. Create Package Structure

```bash
# Database package
mkdir -p packages/database/src/{types,schemas,enums}
mkdir -p packages/database/src/__tests__

# Core package
mkdir -p packages/core/src/{utils,constants,formatters,validators,errors}
mkdir -p packages/core/src/__tests__

# API Client package
mkdir -p packages/api-client/src/{client,queries,mutations}
mkdir -p packages/api-client/src/__tests__
```

## 🔧 Phase 3: Move Code (2 hours)

### 1. Move Database Types

```bash
# Move types from shared to database package
cp -r shared/types/* packages/database/src/types/
cp -r shared/lib/constants.ts packages/database/src/constants/
```

### 2. Move Core Utilities

```bash
# Move utilities to core package
cp shared/lib/utils.ts packages/core/src/utils/
# Move formatters, validators, etc.
```

### 3. Create API Client

Create `packages/api-client/src/client/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/database';

export function createSupabaseClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
```

### 4. Create Query Functions

Create `packages/api-client/src/queries/orders.ts`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Order, OrderWithItems } from '@cafe-idare/database';

export async function fetchOrders(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from('orders')
    .select(`
      *,
      table:tables(*),
      staff(*),
      order_items(
        *,
        menu_item:menu_items(*)
      ),
      order_payments(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as OrderWithItems[];
}

export async function fetchOrder(client: SupabaseClient<Database>, orderId: string) {
  const { data, error } = await client
    .from('orders')
    .select(`
      *,
      table:tables(*),
      staff(*),
      order_items(
        *,
        menu_item:menu_items(*)
      ),
      order_payments(*),
      table_transfers(*)
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data as OrderWithItems;
}
```

## 🔄 Phase 4: Update Imports (1 hour)

### 1. Update App Imports

In `apps/staff-web/src/hooks/use-orders.ts`:
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchOrders, updateOrderStatus } from '@cafe-idare/api-client';
import type { Order, OrderStatus } from '@cafe-idare/database';
import { supabase } from '@/lib/supabase/client';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => fetchOrders(supabase),
  });
}
```

### 2. Update Component Imports

Replace all:
- `@shared/types` → `@cafe-idare/database`
- `@shared/utils` → `@cafe-idare/core`
- Direct supabase calls → `@cafe-idare/api-client`

## 📦 Phase 5: Install & Build (30 minutes)

### 1. Install Dependencies
```bash
# From root
pnpm install
```

### 2. Build Packages
```bash
# Build all packages
pnpm build

# If errors, build packages individually first
cd packages/database && pnpm build && cd ../..
cd packages/core && pnpm build && cd ../..
cd packages/api-client && pnpm build && cd ../..
```

### 3. Start Development
```bash
# From root
pnpm dev
```

## ✅ Phase 6: Verify (30 minutes)

### 1. Test Each App
```bash
# In separate terminals
pnpm dev --filter @cafe-idare/customer-web
pnpm dev --filter @cafe-idare/staff-web
```

### 2. Run Type Checks
```bash
pnpm type-check
```

### 3. Test Hot Reload
1. Make a change in `packages/database/src/types/index.ts`
2. See it reflected in both apps without restart

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Clear all caches
pnpm clean
rm -rf .turbo
pnpm install
pnpm build
```

### Type errors
```bash
# Rebuild TypeScript references
pnpm type-check --force
```

### Hot reload not working
```bash
# Make sure turbo.json has correct config
# Check that package.json has "dev" script with --watch
```

## 🎯 Success Checklist

- [ ] All apps start without errors
- [ ] Type checking passes
- [ ] Hot reload works across packages
- [ ] Build completes successfully
- [ ] No duplicate dependencies in pnpm-lock.yaml
- [ ] CI/CD pipeline passes

## 📈 Performance Improvements

You should see:
- 70% faster builds (with cache)
- 90% faster subsequent builds
- Parallel package builds
- Incremental type checking

## 🚀 Next Steps

1. Set up Changesets for versioning
2. Configure Husky for pre-commit hooks
3. Add E2E tests with Playwright
4. Set up remote caching with Vercel