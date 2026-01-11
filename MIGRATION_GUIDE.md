# Turborepo Migration Guide

## 📋 Prerequisites

Before starting, ensure you have:
- Node.js >= 18.0.0
- pnpm installed globally: `npm install -g pnpm`
- Git repository with all changes committed

## 🎯 Step-by-Step Migration

### Step 1: Initialize Turborepo

```bash
# From the root cafe-idare directory
npx create-turbo@latest --use-pnpm --no-install
# Choose "existing monorepo" when prompted
```

### Step 2: Create New Directory Structure

```bash
# Create directories
mkdir -p apps packages services

# Move existing apps
mv customer-web apps/
mv staff-web apps/
mv mobile-app apps/mobile

# Move shared to packages
mv shared packages/database
```

### Step 3: Install Root Dependencies

Create root `package.json`:
```json
{
  "name": "cafe-idare",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean -- && rm -rf node_modules",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,md,json}\"",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e"
  },
  "devDependencies": {
    "prettier": "^3.1.0",
    "turbo": "latest",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "packageManager": "pnpm@8.14.0"
}
```

### Step 4: Create pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

### Step 5: Configure Turborepo

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".expo/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Step 6: Update Package Names

#### apps/customer-web/package.json
```json
{
  "name": "@cafe-idare/customer-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf .next .turbo node_modules"
  },
  "dependencies": {
    "@cafe-idare/database": "workspace:*",
    "@cafe-idare/core": "workspace:*",
    "@cafe-idare/api-client": "workspace:*",
    // ... other deps
  }
}
```

#### apps/staff-web/package.json
```json
{
  "name": "@cafe-idare/staff-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf .next .turbo node_modules"
  },
  "dependencies": {
    "@cafe-idare/database": "workspace:*",
    "@cafe-idare/core": "workspace:*",
    "@cafe-idare/api-client": "workspace:*",
    // ... other deps
  }
}
```

### Step 7: Create Shared Packages

#### packages/database/package.json
```json
{
  "name": "@cafe-idare/database",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist node_modules .turbo"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

#### packages/core/package.json
```json
{
  "name": "@cafe-idare/core",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs", 
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist node_modules .turbo"
  },
  "dependencies": {
    "@cafe-idare/database": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

#### packages/api-client/package.json
```json
{
  "name": "@cafe-idare/api-client",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist node_modules .turbo"
  },
  "dependencies": {
    "@cafe-idare/database": "workspace:*",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Step 8: Create tsup Configuration

For each package, create `tsup.config.ts`:
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
```

### Step 9: Install Dependencies

```bash
# From root
pnpm install
```

### Step 10: Update Import Paths

Update all imports to use the new package names:
- `@shared/*` → `@cafe-idare/database`
- Local hooks → Keep in apps
- Utilities → `@cafe-idare/core`

## 🔧 Common Issues & Solutions

### Issue: "Cannot find module '@cafe-idare/database'"
Solution: Run `pnpm build` from root to build all packages

### Issue: "Type errors after migration"
Solution: 
1. Delete all node_modules: `pnpm clean`
2. Reinstall: `pnpm install`
3. Rebuild: `pnpm build`

### Issue: "Hot reload not working"
Solution: Make sure `turbo run dev` is running from root

## ✅ Verification Checklist

- [ ] All apps start with `pnpm dev`
- [ ] All packages build with `pnpm build`
- [ ] No TypeScript errors with `pnpm type-check`
- [ ] Hot reload works across packages
- [ ] Supabase types are accessible everywhere

## 🎯 Next Steps After Migration

1. Set up GitHub Actions for CI/CD
2. Configure testing infrastructure
3. Add commit hooks with Husky
4. Set up Changesets for versioning