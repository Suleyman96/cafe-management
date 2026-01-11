# System Architecture

## Overview

Café İdarə uses a modern, serverless architecture with real-time capabilities built on Supabase.

## System Components

### 1. Customer Web Application
**Technology**: Next.js 14 (App Router)

**Access Method**: 
- QR code scan → Redirects to `https://cafe.example.com/table/{table_id}`
- No authentication required
- Session-based table assignment

**Key Features**:
- Server-side rendering for fast initial load
- Progressive Web App (PWA) for offline menu caching
- Optimistic UI updates
- WebSocket connection for real-time order status

**Data Flow**:
```
QR Scan → Load Table Info → Display Menu → Place Order → Real-time Status Updates
```

### 2. Mobile Application (React Native)
**Technology**: React Native (Expo) with TypeScript

**User Roles**:
- Waiter: Table and order management
- Admin: Full system control
- Kitchen: Read-only order display

**Navigation Structure**:
```
Auth Stack (Login)
  └─> Main Stack
       ├─> Waiter Tab Navigator
       │    ├─> Tables Screen
       │    ├─> Orders Screen
       │    └─> Profile Screen
       ├─> Admin Tab Navigator (extends Waiter)
       │    ├─> All Waiter Tabs +
       │    ├─> Menu Management
       │    ├─> Staff Management
       │    └─> Reports
       └─> Kitchen Stack
            └─> Orders Grid Screen
```

**Authentication Flow**:
```
App Launch → Check Auth State
  ├─> Not Authenticated → Login Screen
  └─> Authenticated → Role-Based Navigation
       ├─> Waiter Role → Waiter Tabs
       ├─> Admin Role → Admin Tabs
       └─> Kitchen Role → Kitchen Screen
```

### 3. Backend (Supabase)

**Components**:

#### PostgreSQL Database
- ACID compliance
- Row-level security (RLS)
- Real-time subscriptions
- Full-text search for menu items

#### Supabase Realtime
- WebSocket-based real-time updates
- Subscription channels:
  - `orders:{table_id}` - Customer order updates
  - `orders:all` - Kitchen and waiter order updates
  - `tables:status` - Table status changes
  - `waiter_calls` - Waiter notification channel

#### Supabase Auth
- JWT-based authentication (staff only)
- Role-based access control
- Secure password hashing
- Session management

#### Supabase Storage
- Menu item images
- Image optimization and resizing
- CDN-enabled delivery
- Public read access, admin-only write

#### Edge Functions (Serverless)
- QR code generation
- Report generation
- Email notifications (optional)
- Payment processing hooks (future)

## Data Flow Diagrams

### Order Placement Flow
```
Customer Web                 Supabase                    Mobile App
    │                           │                            │
    │─── Place Order ──────────>│                            │
    │                           │                            │
    │                           │──── Validate & Insert ────>│
    │                           │         (RLS Check)        │
    │                           │                            │
    │                           │──── Realtime Broadcast ───>│
    │                           │    (Kitchen + Waiter)      │
    │                           │                            │
    │<─── Confirmation ─────────│                            │
    │    (WebSocket)            │                            │
    │                           │                            │
    │                           │                            │<─ Sound Alert
    │                           │                            │  (Kitchen)
```

### Status Update Flow
```
Waiter/Kitchen App           Supabase                 Customer Web
    │                           │                            │
    │─── Update Status ────────>│                            │
    │    (Preparing/Ready)      │                            │
    │                           │                            │
    │                           │──── Update Order ─────────>│
    │                           │         (RLS)              │
    │                           │                            │
    │                           │──── Broadcast Update ─────>│
    │                           │       (WebSocket)          │
    │                           │                            │
    │<─── Success ──────────────│                            │
    │                           │                            │
    │                           │                            │<─ UI Update
    │                           │                            │  (Real-time)
```

## Security Architecture

### Authentication & Authorization

**Customer**: No authentication
- Access via QR code (table_id in URL)
- Session tracked by browser session
- Can only interact with their table's orders

**Staff**: Username/password authentication
- JWT tokens with role claims
- Tokens stored securely (mobile keychain/secure storage)
- Auto-refresh before expiration

### Row-Level Security (RLS) Policies

**Tables Table**:
```sql
-- Customers: Read-only access to their own table
CREATE POLICY "Customers can view their table"
  ON tables FOR SELECT
  USING (id = current_table_id());

-- Staff: Read all tables
CREATE POLICY "Staff can view all tables"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

-- Waiters/Admins: Update table status
CREATE POLICY "Staff can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('waiter', 'admin'));
```

**Orders Table**:
```sql
-- Customers: Can insert orders for their table
CREATE POLICY "Customers can place orders"
  ON orders FOR INSERT
  WITH CHECK (table_id = current_table_id() AND status = 'new');

-- Customers: Can view their table's orders
CREATE POLICY "Customers can view their orders"
  ON orders FOR SELECT
  USING (table_id = current_table_id());

-- Staff: View all orders
CREATE POLICY "Staff can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

-- Kitchen: Read-only
CREATE POLICY "Kitchen can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'kitchen');

-- Waiters/Admins: Update order status
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('waiter', 'admin'));
```

**Menu Items**:
```sql
-- Public read access
CREATE POLICY "Anyone can view menu"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- Admin-only write access
CREATE POLICY "Admins can manage menu"
  ON menu_items FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

## Real-Time Subscriptions

### Customer Web App
```javascript
// Subscribe to order updates for specific table
const orderSubscription = supabase
  .channel(`orders:table_${tableId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `table_id=eq.${tableId}`
    },
    (payload) => {
      // Update UI with new order status
    }
  )
  .subscribe();
```

### Mobile App (Kitchen)
```javascript
// Subscribe to all new orders
const kitchenSubscription = supabase
  .channel('orders:kitchen')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'orders'
    },
    (payload) => {
      // Play sound alert
      // Add order to kitchen display
    }
  )
  .subscribe();
```

### Mobile App (Waiter)
```javascript
// Subscribe to waiter calls
const waiterCallSubscription = supabase
  .channel('waiter_calls')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'waiter_calls'
    },
    (payload) => {
      // Show notification
      // Play alert sound
    }
  )
  .subscribe();
```

## Scalability Considerations

### Database Optimization
- Indexed columns: `table_id`, `status`, `created_at`
- Partitioning: Archive old orders monthly
- Connection pooling: Supabase handles automatically
- Read replicas: For reporting queries (future)

### Caching Strategy
- Menu items: Cache in CDN (Vercel Edge)
- Static assets: CloudFront/Vercel CDN
- Client-side: React Query cache (5 min stale time)

### Performance Targets
- Initial page load: < 2 seconds
- Real-time update latency: < 500ms
- API response time: < 200ms (p95)
- Concurrent users: 100+ per café

## Monitoring & Observability

### Metrics to Track
- Order placement success rate
- Average order preparation time
- Real-time connection stability
- API response times
- Error rates by endpoint

### Tools
- Supabase Dashboard: Built-in metrics
- Sentry: Error tracking
- LogRocket: Session replay (customer web)
- Custom analytics: Order and revenue metrics

## Disaster Recovery

### Backup Strategy
- Automatic daily backups (Supabase)
- Point-in-time recovery (7 days)
- Weekly backup downloads to S3

### High Availability
- Supabase: 99.9% uptime SLA
- Multi-region failover (enterprise plan)
- Graceful degradation when backend is down

## Development & Deployment

### Environments
- **Development**: Local Supabase + local dev servers
- **Staging**: Supabase staging project + preview deployments
- **Production**: Supabase production + main branch

### CI/CD Pipeline
```
Git Push → GitHub Actions
  ├─> Run Tests
  ├─> Lint & Type Check
  ├─> Build
  └─> Deploy
       ├─> Customer Web → Vercel
       ├─> Mobile App → Expo EAS
       └─> Database Migrations → Supabase CLI
```

### Feature Flags
- Use Supabase Edge Functions + database table
- Enable/disable features per café
- A/B testing capability

## Future Enhancements

1. **Multi-café Support**: Single deployment, multiple locations
2. **Analytics Dashboard**: Real-time business intelligence
3. **Inventory Management**: Track ingredient levels
4. **Loyalty Program**: Customer accounts (optional)
5. **Online Orders**: Takeaway and delivery
6. **Payment Integration**: Stripe or local payment gateways
7. **Voice Orders**: Integration with smart speakers
8. **AI Recommendations**: Suggest items based on order history


