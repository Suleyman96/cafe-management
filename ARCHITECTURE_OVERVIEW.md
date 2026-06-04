# Architecture Overview - Gustri

## 🏗️ Current Architecture (Web-First, Mobile-Ready)

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT APPS                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Customer Web (Next.js)    Staff Web (Next.js)        │
│  ├─ QR ordering            ├─ Login/Auth               │
│  ├─ Menu browsing          ├─ Tables management        │
│  ├─ Cart & checkout        ├─ Orders management        │
│  └─ Order tracking         └─ Kitchen display          │
│                                                         │
│  Both use: shared/ folder                              │
│  ├─ types/     (100% shared)                           │
│  ├─ lib/utils  (100% shared)                           │
│  └─ constants  (100% shared)                           │
│                                                         │
└────────────┬────────────────────────────────────────────┘
             │
             │ HTTPS/WebSocket
             ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE BACKEND                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PostgreSQL Database                                    │
│  ├─ Tables, orders, menu_items                         │
│  ├─ Row Level Security (RLS)                           │
│  └─ Real-time subscriptions                            │
│                                                         │
│  Authentication                                         │
│  ├─ JWT tokens for staff                               │
│  └─ QR token for customers                             │
│                                                         │
│  Storage                                                │
│  ├─ Menu images                                        │
│  └─ QR code images                                     │
│                                                         │
│  Edge Functions (Optional)                             │
│  └─ QR generation, reports                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Customer Order Flow:

```
1. Customer scans QR code
   └─> Opens: customer.cafe.com/table/T01?token=xxx

2. Customer browses menu
   ├─> Fetches: Menu items, categories
   └─> From: Supabase (RLS allows public read)

3. Customer adds to cart
   └─> Stored: Browser localStorage (Zustand)

4. Customer places order
   ├─> Creates: Order record
   ├─> Creates: Order items
   └─> Triggers: Database function (calculate total)

5. Real-time update sent
   ├─> To: Staff web app
   ├─> To: Kitchen display
   └─> Via: Supabase Realtime (WebSocket)

6. Customer sees status updates
   └─> Via: Real-time subscription to orders table
```

### Staff Order Management Flow:

```
1. Staff logs in
   ├─> Authenticates: Supabase Auth (JWT)
   └─> Fetches: Staff profile + role

2. Dashboard loads
   ├─> Subscribes: Orders changes (real-time)
   ├─> Subscribes: Waiter calls
   └─> Subscribes: Table status

3. New order arrives
   ├─> Receives: WebSocket message
   ├─> Plays: Sound alert (browser audio)
   └─> Shows: Notification

4. Staff updates order status
   ├─> Updates: Order.status = 'preparing'
   ├─> Sets: Order.preparing_at = NOW()
   └─> Broadcasts: To all clients

5. Customer sees update
   └─> Receives: Real-time notification
```

---

## 🔐 Security Model

### Customer Access (No Auth):
```
┌─────────────┐
│   Customer  │
│  (No login) │
└──────┬──────┘
       │
       │ QR Token in URL
       │
       ▼
┌─────────────────┐
│  Set Context    │
│  (Session var)  │
└──────┬──────────┘
       │
       │ RLS checks token
       │
       ▼
┌─────────────────┐
│  Can only see:  │
│  - Their table  │
│  - Their orders │
│  - Public menu  │
└─────────────────┘
```

### Staff Access (Authenticated):
```
┌─────────────┐
│    Staff    │
│ (JWT token) │
└──────┬──────┘
       │
       │ Login credentials
       │
       ▼
┌─────────────────┐
│  Supabase Auth  │
│  Returns JWT    │
└──────┬──────────┘
       │
       │ RLS checks role
       │
       ▼
┌─────────────────┐
│  Can access:    │
│  - All orders   │
│  - All tables   │
│  - Role-based   │
│    features     │
└─────────────────┘
```

---

## 💾 Database Schema

### Core Tables:

```sql
tables          -- Physical café tables
├─ id, table_number, qr_code
├─ status (free/occupied/reserved)
└─ current_session_id → orders.id

orders          -- Customer orders
├─ id, order_number, table_id
├─ status (new/preparing/ready/served)
├─ subtotal, tax, total
└─ timestamps (created, preparing, ready, etc.)

order_items     -- Items in orders
├─ id, order_id, menu_item_id
├─ quantity, notes
└─ status (pending/preparing/ready)

menu_items      -- Menu items
├─ id, category_id
├─ name_en, name_az, name_ru, name_tr
├─ price, image_url
└─ allergens, dietary info

staff           -- Staff members
├─ id, email, full_name
├─ role (waiter/admin/kitchen)
└─ auth_user_id → auth.users.id

waiter_calls    -- Customer assistance requests
├─ id, table_id, reason
├─ status (pending/acknowledged/resolved)
└─ responded_by → staff.id
```

---

## 🔄 Real-Time Architecture

### Supabase Realtime (PostgreSQL + WebSocket):

```
┌──────────────────┐
│   PostgreSQL     │
│   (Changes)      │
└────────┬─────────┘
         │
         │ Triggers
         ▼
┌──────────────────┐
│ Realtime Server  │
│ (Broadcast)      │
└────────┬─────────┘
         │
         │ WebSocket
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Customer Web    │     │   Staff Web      │
│  (Subscribes)    │     │   (Subscribes)   │
└──────────────────┘     └──────────────────┘
```

### Subscriptions:

**Customer App**:
```typescript
supabase
  .channel(`orders:table_${tableId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `table_id=eq.${tableId}`
  }, handleOrderUpdate)
  .subscribe();
```

**Staff App**:
```typescript
supabase
  .channel('orders:all')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'orders'
  }, handleNewOrder)
  .subscribe();
```

---

## 📦 Code Organization

### Shared Package Strategy:

```
shared/
├── types/           # TypeScript definitions
│   ├── database.ts  # Supabase auto-generated
│   └── index.ts     # Extended types
│
├── lib/
│   ├── utils.ts     # Helper functions
│   │   ├─ formatPrice()
│   │   ├─ timeAgo()
│   │   ├─ getStatusColor()
│   │   └─ calculateTax()
│   │
│   └── constants.ts # App constants
│       ├─ ORDER_STATUS
│       ├─ TABLE_STATUS
│       └─ DEFAULT_TAX_PERCENTAGE
│
└── package.json
```

**Used by**:
- ✅ customer-web
- ✅ staff-web
- ✅ mobile-app (future)

**Benefits**:
- Single source of truth
- Type safety everywhere
- Easy to maintain
- Ready for RN Web

---

## 🚀 Deployment Architecture

### Development:
```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ localhost   │   │ localhost   │   │  Supabase   │
│   :3000     │   │   :3001     │   │   Local     │
│  Customer   │   │   Staff     │   │   Docker    │
└─────────────┘   └─────────────┘   └─────────────┘
```

### Production:
```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│    Vercel        │   │    Vercel        │   │   Supabase       │
│  customer-app    │   │  staff-app       │   │   Cloud          │
│  .vercel.app     │   │  .vercel.app     │   │  .supabase.co    │
└──────────────────┘   └──────────────────┘   └──────────────────┘
         │                      │                       │
         └──────────────────────┴───────────────────────┘
                            │
                      Single Backend
                    (Database, Auth, Storage)
```

---

## 🎯 Performance Optimizations

### Frontend:
- ✅ Server-side rendering (Next.js)
- ✅ Static generation for menu
- ✅ Image optimization (Next.js Image)
- ✅ React Query caching
- ✅ Optimistic UI updates
- ✅ Lazy loading components

### Backend:
- ✅ Database indexes on foreign keys
- ✅ Row Level Security (no backend logic needed)
- ✅ Connection pooling (Supabase)
- ✅ CDN for static assets
- ✅ Edge functions for compute

### Real-time:
- ✅ Efficient WebSocket connections
- ✅ Filtered subscriptions (only relevant data)
- ✅ Automatic reconnection
- ✅ Backpressure handling

---

## 📈 Scalability Plan

### Phase 1 (Now): Single Café
```
Users: 50-100/day
Orders: 30-50/day
Cost: $0/month
Supabase: Free tier
Vercel: Free tier
```

### Phase 2: Growing
```
Users: 200-500/day
Orders: 100-200/day
Cost: $25/month
Supabase: Pro tier
Vercel: Free tier
```

### Phase 3: Multiple Locations
```
Users: 1000+/day
Orders: 500+/day
Cost: $45/month
Supabase: Pro tier
Vercel: Pro tier
Multi-tenant setup
```

---

## 🔮 Future Architecture (React Native Web)

When mobile apps are needed:

```
┌─────────────────────────────────────────────────────────┐
│          Single React Native App                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Runs on:                                               │
│  ├─ 🌐 Web (customer + staff)                          │
│  ├─ 📱 iOS (staff only)                                │
│  └─ 🤖 Android (staff only)                            │
│                                                         │
│  90% Code Reuse!                                        │
│  ├─ Components work everywhere                         │
│  ├─ Business logic shared                              │
│  └─ Types & utils from shared/                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Migration path**: See `docs/history/MIGRATION_TO_RN_WEB.md` (historical)

---

## 🎨 Design Principles

### Mobile-First:
- Large touch targets (44x44px)
- Optimized for tablets
- Works on phones
- Fast on slow networks

### Real-Time:
- Instant updates everywhere
- No manual refresh needed
- WebSocket connections
- Optimistic UI updates

### Accessible:
- Multi-language support
- Clear visual hierarchy
- Color-coded statuses
- Screen reader friendly

### Maintainable:
- Shared code reduces duplication
- Type-safe with TypeScript
- Well-documented
- Easy to extend

---

## 📚 Technology Decisions

### Why Supabase?
✅ PostgreSQL (proven, scalable)
✅ Built-in realtime
✅ Row Level Security
✅ Auto-generated APIs
✅ Free tier generous
✅ Easy to self-host if needed

### Why Next.js?
✅ React-based (easy to learn)
✅ Server-side rendering
✅ Great performance
✅ Easy deployment
✅ Can convert to RN Web later

### Why shared/ folder?
✅ DRY principle
✅ Single source of truth
✅ Easy migration to RN Web
✅ Type safety
✅ Consistent logic

---

## ✅ Quality Checklist

- [x] Type-safe (TypeScript everywhere)
- [x] Real-time updates
- [x] Secure (RLS policies)
- [x] Mobile-optimized
- [x] Accessible
- [x] Documented
- [x] Testable
- [x] Scalable
- [x] Cost-effective
- [x] Future-proof

---

**Architecture Review**: ✅ Production Ready

This architecture provides:
- **Immediate value**: $0 cost web apps
- **Easy scaling**: Upgrade when needed
- **Future-proof**: Ready for mobile
- **Maintainable**: Shared code, clear structure
- **Flexible**: Can adapt to any requirement

🎉 **Ready to deploy!**


