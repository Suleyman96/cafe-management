/**
 * Comprehensive Supabase Wrapper
 * Provides type-safe operations for database operations.
 *
 * This module composes all domain-specific wrappers into a single unified API.
 */

import type { Database } from '@cafe-idare/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createExpenseCategoriesWrapper, createExpensesWrapper } from './expenses';
import { createFeedbackWrapper } from './feedback';
import { createCategoriesWrapper, createMenuItemsWrapper } from './menu';
import { createOrderItemsWrapper, createOrdersWrapper } from './orders';
import { createPaymentsWrapper } from './payments';
import { createRealtimeWrapper } from './realtime';
import { createRpcWrapper } from './rpc';
import { createSettingsWrapper } from './settings';
import { createStaffWrapper } from './staff';
import { createStaffNotesWrapper } from './staff-notes';
import { createStockItemsWrapper } from './stock';
import { createTablesWrapper } from './tables';
import type { AnySupabaseClient, WrapperContext } from './types';
import { createViewsWrapper } from './views';
import { createWaiterCallsWrapper } from './waiter-calls';

export class SupabaseWrapper {
  private ctx: WrapperContext;

  // Domain wrappers
  tables;
  orders;
  orderItems;
  menuItems;
  categories;
  staff;
  feedback;
  payments;
  waiterCalls;
  staffNotes;
  settings;
  stockItems;
  expenseCategories;
  expenses;
  rpc;
  views;
  realtime;

  constructor(client: SupabaseClient<Database>) {
    // Create context with both typed and untyped clients
    this.ctx = {
      client,
      anyClient: client as AnySupabaseClient,
    };

    // Initialize all domain wrappers
    this.tables = createTablesWrapper(this.ctx);
    this.orders = createOrdersWrapper(this.ctx);
    this.orderItems = createOrderItemsWrapper(this.ctx);
    this.menuItems = createMenuItemsWrapper(this.ctx);
    this.categories = createCategoriesWrapper(this.ctx);
    this.staff = createStaffWrapper(this.ctx);
    this.feedback = createFeedbackWrapper(this.ctx);
    this.payments = createPaymentsWrapper(this.ctx);
    this.waiterCalls = createWaiterCallsWrapper(this.ctx);
    this.staffNotes = createStaffNotesWrapper(this.ctx);
    this.settings = createSettingsWrapper(this.ctx);
    this.stockItems = createStockItemsWrapper(this.ctx);
    this.expenseCategories = createExpenseCategoriesWrapper(this.ctx);
    this.expenses = createExpensesWrapper(this.ctx);
    this.rpc = createRpcWrapper(this.ctx);
    this.views = createViewsWrapper(this.ctx);
    this.realtime = createRealtimeWrapper(this.ctx);
  }
}

// Export factory function
export function createSupabaseWrapper(client: SupabaseClient<Database>) {
  return new SupabaseWrapper(client);
}

export type { ExpenseCategoriesWrapper, ExpensesWrapper } from './expenses';
export type { FeedbackWrapper } from './feedback';
export type { CategoriesWrapper, MenuItemsWrapper } from './menu';
export type { OrderItemsWrapper, OrdersWrapper } from './orders';
export type { PaymentsWrapper } from './payments';
export type { RealtimeWrapper } from './realtime';
export type { RpcWrapper } from './rpc';
export type { SettingsWrapper } from './settings';
export type { StaffWrapper } from './staff';
export type { StaffNotesWrapper } from './staff-notes';
export type { StockItemsWrapper } from './stock';
export type { TablesWrapper } from './tables';
// Re-export types
export * from './types';
export type { ViewsWrapper } from './views';
export type { WaiterCallsWrapper } from './waiter-calls';
