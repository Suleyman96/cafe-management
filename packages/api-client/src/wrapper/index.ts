/**
 * Comprehensive Supabase Wrapper
 * Provides type-safe operations for database operations.
 *
 * This module composes all domain-specific wrappers into a single unified API.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/database';
import type { WrapperContext, AnySupabaseClient } from './types';

import { createTablesWrapper } from './tables';
import { createOrdersWrapper, createOrderItemsWrapper } from './orders';
import { createMenuItemsWrapper, createCategoriesWrapper } from './menu';
import { createStaffWrapper } from './staff';
import { createFeedbackWrapper } from './feedback';
import { createPaymentsWrapper } from './payments';
import { createWaiterCallsWrapper } from './waiter-calls';
import { createStaffNotesWrapper } from './staff-notes';
import { createSettingsWrapper } from './settings';
import { createRpcWrapper } from './rpc';
import { createViewsWrapper } from './views';
import { createRealtimeWrapper } from './realtime';

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
    this.rpc = createRpcWrapper(this.ctx);
    this.views = createViewsWrapper(this.ctx);
    this.realtime = createRealtimeWrapper(this.ctx);
  }
}

// Export factory function
export function createSupabaseWrapper(client: SupabaseClient<Database>) {
  return new SupabaseWrapper(client);
}

// Re-export types
export * from './types';
export type { TablesWrapper } from './tables';
export type { OrdersWrapper, OrderItemsWrapper } from './orders';
export type { MenuItemsWrapper, CategoriesWrapper } from './menu';
export type { StaffWrapper } from './staff';
export type { FeedbackWrapper } from './feedback';
export type { PaymentsWrapper } from './payments';
export type { WaiterCallsWrapper } from './waiter-calls';
export type { StaffNotesWrapper } from './staff-notes';
export type { SettingsWrapper } from './settings';
export type { RpcWrapper } from './rpc';
export type { ViewsWrapper } from './views';
export type { RealtimeWrapper } from './realtime';
