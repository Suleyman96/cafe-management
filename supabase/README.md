# Supabase Backend Configuration

This directory contains all backend configuration for the Gustri system.

## Structure

```
supabase/
├── config.toml           # Supabase project configuration
├── migrations/           # Database migrations
│   ├── 20250101000001_initial_schema.sql
│   ├── 20250101000002_functions_triggers.sql
│   ├── 20250101000003_rls_policies.sql
│   └── 20250101000004_views.sql
├── functions/            # Edge Functions (optional)
└── seed.sql             # Sample data for development
```

## Setup

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

### 2. Initialize Local Development

```bash
# Start local Supabase instance
supabase start

# This will start:
# - PostgreSQL database
# - Supabase Studio (http://localhost:54323)
# - API server
# - Realtime server
```

### 3. Run Migrations

```bash
# Run all migrations
supabase db reset

# Or apply migrations individually
supabase migration up
```

### 4. Seed Database

```bash
# Load sample data
supabase db reset --seed-only

# Or manually
psql -h localhost -p 54322 -U postgres -d postgres -f seed.sql
```

## Database Schema

### Tables

- **staff**: Staff members (waiter, admin, kitchen)
- **tables**: Physical café tables
- **categories**: Menu categories
- **menu_items**: Menu items
- **orders**: Customer orders
- **order_items**: Individual items in orders
- **waiter_calls**: Customer requests for waiter

### Views

- **active_orders_view**: Real-time view of active orders for kitchen/waiter
- **sales_summary_view**: Daily sales summary for reports

### Functions

- `generate_order_number()`: Auto-generate order numbers
- `calculate_order_total()`: Calculate subtotal, tax, and total
- `set_table_context()`: Set session context for customer RLS
- `update_updated_at_column()`: Auto-update timestamps

## Row Level Security (RLS)

### Customer Access (No Auth)
- Can view menu items and categories
- Can view/create orders for their table (via QR token)
- Can create waiter calls
- Scoped to their table only

### Staff Access (Authenticated)
- **Waiter**: View all orders/tables, update orders
- **Kitchen**: View all orders, update item status (read-only for menu)
- **Admin**: Full access to all tables

## Deployment

### Deploy to Supabase Cloud

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Deploy edge functions (if any)
supabase functions deploy
```

### Environment Variables

Set these in your Supabase project dashboard:

- **JWT_EXPIRY**: 3600 (1 hour)
- **ENABLE_SIGNUP**: false (only admins create accounts)
- **SITE_URL**: Your production URL

## Backup & Restore

### Backup

```bash
# Backup entire database
supabase db dump -f backup.sql

# Backup specific table
pg_dump -h localhost -p 54322 -U postgres -t orders -d postgres > orders_backup.sql
```

### Restore

```bash
# Restore from backup
psql -h localhost -p 54322 -U postgres -d postgres < backup.sql
```

## Testing

### Sample Queries

```sql
-- Get all active orders
SELECT * FROM active_orders_view;

-- Get today's sales
SELECT * FROM sales_summary_view WHERE date = CURRENT_DATE;

-- Get pending waiter calls
SELECT * FROM waiter_calls WHERE status = 'pending';
```

### Test RLS Policies

```sql
-- Test customer access (set table context first)
SELECT set_table_context('qr_token_table_01');
SELECT * FROM orders; -- Should only see orders for table T01

-- Test staff access
SET ROLE authenticated;
SELECT * FROM orders; -- Should see all orders
```

## Monitoring

Access Supabase Studio for:
- Real-time database queries
- API logs
- User management
- Storage browser

URL: `http://localhost:54323` (local) or your Supabase dashboard (cloud)

## Troubleshooting

### Migration Errors

```bash
# Check migration status
supabase migration list

# Repair migration state
supabase migration repair 20250101000001

# Reset database completely
supabase db reset
```

### Connection Issues

```bash
# Check service status
supabase status

# View logs
supabase logs
```

### RLS Issues

```bash
# Test policies
SELECT * FROM tables WHERE id = '20000000-0000-0000-0000-000000000001';

# Check current role
SELECT current_user, current_setting('role');
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)


