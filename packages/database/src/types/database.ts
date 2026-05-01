/**
 * Database type definitions.
 *
 * The shape comes from `./generated.ts` (regenerate via `pnpm db:types:generate`).
 * The overlay below preserves the column unions and non-null assertions the
 * wrapper layer and UI rely on. Two reasons the overlay exists:
 *
 *   1. CHECK-constraint narrowings — Postgres CHECK predicates aren't visible
 *      to the type generator, so columns like `orders.status` come out as
 *      plain `string`. We narrow them to the actual literal union.
 *
 *   2. Default-populated non-null narrowings — columns with DB DEFAULTs but
 *      no NOT NULL constraint show up as `T | null` in the generator. In
 *      practice the DB always populates them (defaults run on INSERT), and
 *      the previous hand-written types declared them non-null. We preserve
 *      that to avoid forcing null-handling across the consumer layer.
 *
 * If you find a column that DOES return null at runtime, remove its entry
 * from the per-table narrowing rather than papering over it at the call site.
 */

import type { Database as Generated, Json } from './generated';

export type { Json };

type GeneratedTables = Generated['public']['Tables'];

// Per-table column narrowings. Each entry replaces the generator's column
// type entirely (so to keep nullability include `| null` here when needed).
type TableNarrowings = {
  app_versions: {
    platform: 'ios' | 'android';
  };
  cafe_settings: {
    currency_position: 'before' | 'after';
    created_at: string;
    updated_at: string;
  };
  categories: {
    created_at: string;
    updated_at: string;
    is_active: boolean;
    display_order: number;
  };
  customer_feedback: {
    feedback_type: 'complaint' | 'praise';
    status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
    created_at: string;
  };
  delivery_customers: {
    created_at: string;
    updated_at: string;
    order_count: number;
  };
  expense_categories: {
    created_at: string;
    is_active: boolean;
  };
  expenses: {
    payment_method: 'cash' | 'card' | 'digital' | 'bank_transfer';
    created_at: string;
    updated_at: string;
  };
  menu_items: {
    created_at: string;
    updated_at: string;
    is_available: boolean;
    is_popular: boolean;
    is_vegetarian: boolean;
    is_vegan: boolean;
    is_gluten_free: boolean;
    is_spicy: boolean;
    is_daily_special: boolean;
    display_order: number;
  };
  order_items: {
    status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
    created_at: string;
    updated_at: string;
  };
  order_payments: {
    payment_method: 'cash' | 'card' | 'digital';
    payment_type: 'full' | 'partial_amount' | 'specific_items';
    created_at: string;
    tip_amount: number;
  };
  orders: {
    status:
      | 'pending_approval'
      | 'new'
      | 'preparing'
      | 'ready'
      | 'served'
      | 'out_for_delivery'
      | 'delivered'
      | 'closed'
      | 'cancelled';
    source: 'customer' | 'waiter' | 'phone';
    // order_type/discount_type are nullable in the schema (no NOT NULL),
    // but the CHECK constraint restricts them to these literals.
    order_type: 'dine_in' | 'takeout' | 'delivery' | null;
    discount_type: 'none' | 'percentage' | 'fixed' | null;
    // order_number is NOT NULL but a trigger populates it; listing it here
    // makes it optional on Insert (Partial<TableNarrowings[K]> wrapping).
    order_number: string;
    created_at: string;
    updated_at: string;
    delivery_fee: number;
    discount_value: number;
    discount_amount: number;
  };
  refunds: {
    refund_method: 'cash' | 'card' | 'digital';
  };
  staff: {
    role: 'waiter' | 'admin' | 'kitchen' | 'owner';
    created_at: string;
    updated_at: string;
    is_active: boolean;
    preferred_language: string;
  };
  staff_schedules: {
    status: 'scheduled' | 'in_progress' | 'completed' | 'missed';
    created_at: string;
    updated_at: string;
  };
  stock_items: {
    created_at: string;
    updated_at: string;
    is_active: boolean;
  };
  stock_movements: {
    movement_type: 'in' | 'out' | 'adjustment';
    created_at: string;
  };
  tables: {
    status: 'free' | 'occupied' | 'reserved' | 'closed';
    created_at: string;
    updated_at: string;
    is_active: boolean;
  };
  tasks: {
    // priority/status/recurrence_pattern are nullable per the schema.
    priority: 'low' | 'normal' | 'high' | 'urgent' | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | null;
    recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null;
    created_at: string;
    updated_at: string;
    is_recurring: boolean;
  };
  tenants: {
    plan: 'free' | 'standard' | 'pro' | 'business';
  };
  waiter_calls: {
    // No CHECK on call_type/priority — these are convention-only.
    call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency' | null;
    priority: 'low' | 'normal' | 'high' | 'urgent' | null;
    status: 'pending' | 'acknowledged' | 'resolved';
    created_at: string;
  };
  waste_logs: {
    reason:
      | 'expired'
      | 'spoiled'
      | 'overcooked'
      | 'dropped'
      | 'returned_by_customer'
      | 'preparation_waste'
      | 'other';
    created_at: string;
  };
};

type ApplyNarrowing<T, N> = Omit<T, keyof N> & N;

type NarrowedTables = {
  [K in keyof GeneratedTables]: K extends keyof TableNarrowings
    ? Omit<GeneratedTables[K], 'Row' | 'Insert' | 'Update'> & {
        Row: ApplyNarrowing<GeneratedTables[K]['Row'], TableNarrowings[K]>;
        Insert: Omit<GeneratedTables[K]['Insert'], keyof TableNarrowings[K]> &
          Partial<TableNarrowings[K]>;
        Update: Omit<GeneratedTables[K]['Update'], keyof TableNarrowings[K]> &
          Partial<TableNarrowings[K]>;
      }
    : GeneratedTables[K];
};

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Tables'> & {
    Tables: NarrowedTables;
  };
};
