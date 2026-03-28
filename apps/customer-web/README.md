# Gustri - Customer Web App

Mobile-first web application for in-store ordering via QR codes.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Real-time**: Supabase Realtime
- **UI Components**: Custom components with Radix UI primitives

## Features

- QR code-based table access (no login required)
- Multi-language support (EN, AZ, RU, TR)
- Browse menu with categories and filters
- Add items to cart with custom notes
- Real-time order status tracking
- Call waiter functionality
- Mobile-optimized UI

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase project set up

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your Supabase credentials
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_NAME="Gustri"
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── table/
│   │   └── [tableId]/     # Table-specific routes
│   │       ├── page.tsx   # Table landing
│   │       ├── menu/      # Menu browsing
│   │       ├── cart/      # Cart & checkout
│   │       └── order/     # Order status
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── table/            # Table-related components
│   ├── menu/             # Menu components
│   ├── cart/             # Cart components
│   └── order/            # Order tracking components
├── hooks/                # React Query hooks
│   ├── use-table.ts
│   ├── use-menu.ts
│   ├── use-order.ts
│   └── use-waiter-call.ts
├── store/                # Zustand stores
│   ├── cart-store.ts
│   └── language-store.ts
├── lib/                  # Utilities
│   ├── supabase.ts       # Supabase client
│   └── utils.ts          # Helper functions
└── types/                # TypeScript types
    ├── database.ts       # Supabase types
    └── index.ts          # Shared types
```

## Key Screens

### 1. Table Landing (`/table/[tableId]`)
- Displays table information
- Language selector
- Entry point to menu

### 2. Menu (`/table/[tableId]/menu`)
- Category tabs
- Menu items grid
- Item details modal
- Add to cart

### 3. Cart (`/table/[tableId]/cart`)
- Review items
- Adjust quantities
- Add order notes
- Place order

### 4. Order Status (`/table/[tableId]/order`)
- Real-time order tracking
- Status timeline
- Item-level status
- Call waiter

## Real-Time Features

The app uses Supabase Realtime for live updates:

- Order status changes
- Item preparation status
- Waiter responses

## Performance Optimization

- Server-side rendering for initial load
- Image optimization with Next.js Image
- React Query caching
- Lazy loading for components
- PWA support for offline menu viewing

## Mobile Optimization

- Touch-friendly UI (44x44px minimum touch targets)
- Large buttons and text
- Swipe gestures support
- Mobile-first responsive design
- Fast page transitions

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

The app will be automatically deployed on every push to the main branch.

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Docker
- Node.js server

## Testing

```bash
# Run type checking
npm run type-check

# Run linter
npm run lint
```

## Contributing

See main project README for contribution guidelines.

## License

Proprietary - All rights reserved


