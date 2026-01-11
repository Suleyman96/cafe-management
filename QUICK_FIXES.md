# Quick Fixes for Current Architecture

## 🚀 Immediate Actions (Can Do Today)

### 1. **Standardize TypeScript Configuration**

Create a base `tsconfig.json` in the root:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true
  }
}
```

### 2. **Fix Package.json Dependencies**

**In `staff-web/package.json`**:
```json
{
  "dependencies": {
    "@cafe-idare/shared": "file:../shared",
    // ... other deps
  }
}
```

Run: `npm install` in each directory

### 3. **Create Environment Validation**

Create `staff-web/src/lib/env.ts`:
```typescript
const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

// Validate at build time
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const env = requiredEnvVars;
```

### 4. **Centralize Supabase Client**

Create `staff-web/src/lib/supabase/singleton.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/shared';
import { env } from '../env';

// Create singleton instance
const supabaseClient = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export { supabaseClient as supabase };
```

### 5. **Fix Import Aliases**

Update `staff-web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@hooks": ["./src/hooks"],
      "@components": ["./src/components"],
      "@lib": ["./src/lib"]
    }
  }
}
```

### 6. **Add Build Scripts**

Update root `package.json`:
```json
{
  "scripts": {
    "build:all": "npm run build:shared && npm run build:customer && npm run build:staff",
    "build:shared": "cd shared && npm run build",
    "build:customer": "cd customer-web && npm run build",
    "build:staff": "cd staff-web && npm run build",
    "dev:staff": "cd staff-web && npm run dev",
    "dev:customer": "cd customer-web && npm run dev",
    "type-check:all": "npm run type-check:shared && npm run type-check:customer && npm run type-check:staff",
    "clean": "rm -rf **/node_modules **/.next **/dist"
  }
}
```

### 7. **Add VS Code Settings**

Create `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

## 🛠️ Common Error Fixes

### Error: "Module not found: Can't resolve '@cafe-idare/shared'"
```bash
cd staff-web
npm install ../shared
```

### Error: "No QueryClient set"
Always use local hooks that import from '@tanstack/react-query' directly

### Error: "Type 'X' is not assignable to type 'Y'"
1. Check that all packages use same TypeScript version
2. Run `npm run type-check:all` from root
3. Ensure types are exported from shared package

## 🎯 Development Workflow

1. **Start Supabase**: `npx supabase start`
2. **Start Dev Server**: `npm run dev:staff`
3. **Type Checking**: Run in separate terminal: `npm run type-check:all -- --watch`
4. **Before Commit**: `npm run build:all`

## 📋 Checklist

- [ ] All TypeScript configs extend from base
- [ ] Environment variables validated at build
- [ ] Supabase client is singleton
- [ ] All imports use proper aliases
- [ ] Build scripts work from root
- [ ] VS Code configured properly
- [ ] No circular dependencies
- [ ] All types exported from shared