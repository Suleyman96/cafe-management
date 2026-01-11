# Shared Package

This package contains shared code used across all Café İdarə applications:
- `customer-web` (Next.js)
- `staff-web` (Next.js)
- `mobile-app` (React Native) - for future use

## Structure

```
shared/
├── types/           # TypeScript type definitions
│   ├── database.ts  # Supabase database types
│   └── index.ts     # Exported types
├── lib/             # Utility functions
│   ├── utils.ts     # Helper functions
│   └── constants.ts # Shared constants
└── README.md
```

## Usage

### In customer-web or staff-web:

```typescript
// Import types
import type { Order, MenuItem } from '../../../shared/types';

// Import utilities
import { formatPrice, timeAgo } from '../../../shared/lib/utils';

// Import constants
import { ORDER_STATUS, TAX_RATE } from '../../../shared/lib/constants';
```

### In mobile-app (future):

```typescript
// Same imports work!
import type { Order, MenuItem } from '../../shared/types';
import { formatPrice, timeAgo } from '../../shared/lib/utils';
```

## Benefits

1. **Single Source of Truth**: Types defined once, used everywhere
2. **Consistency**: Same logic across all platforms
3. **Easy Updates**: Change once, updates everywhere
4. **Type Safety**: Full TypeScript support
5. **Future-Proof**: Ready for React Native Web conversion

## When Converting to React Native Web

This shared package will be used as-is. No changes needed! 

The utilities are platform-agnostic and work on:
- ✅ Browser (Next.js)
- ✅ React Native
- ✅ Node.js (server-side)

## Maintenance

- Keep types in sync with Supabase schema
- Add new utilities as needed
- Document breaking changes
- Version changes if needed


