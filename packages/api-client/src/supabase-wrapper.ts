/**
 * Comprehensive Supabase Wrapper
 *
 * This file re-exports from the modular wrapper structure.
 * For the implementation, see the ./wrapper directory.
 *
 * The wrapper is split into domain-specific modules:
 * - tables.ts - Table operations
 * - orders.ts - Orders and order items operations
 * - menu.ts - Menu items and categories operations
 * - staff.ts - Staff operations
 * - feedback.ts - Customer feedback operations
 * - payments.ts - Payment operations
 * - waiter-calls.ts - Waiter call operations
 * - rpc.ts - RPC function calls
 * - views.ts - Database view operations
 * - realtime.ts - Realtime subscription helpers
 */

export { createSupabaseWrapper, SupabaseWrapper } from './wrapper';
export * from './wrapper/types';
