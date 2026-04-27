/**
 * Comprehensive Supabase Wrapper
 * Provides type-safe operations for database operations.
 *
 * This module composes all domain-specific wrappers into a single unified API.
 */

import type { Database } from '@gustri/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDeliveryCustomersWrapper } from './delivery-customers';
import { createExpenseCategoriesWrapper, createExpensesWrapper } from './expenses';
import { createFeedbackWrapper } from './feedback';
import { createCategoriesWrapper, createMenuItemsWrapper } from './menu';
import { createOrderItemsWrapper, createOrdersWrapper } from './orders';
import { createPaymentsWrapper } from './payments';
import { createRealtimeWrapper } from './realtime';
import { createRefundsWrapper } from './refunds';
import { createReportsWrapper } from './reports';
import { createRpcWrapper } from './rpc';
import { createSchedulesWrapper } from './schedules';
import { createSettingsWrapper } from './settings';
import { createStaffWrapper } from './staff';
import { createStockItemsWrapper } from './stock';
import { createTablesWrapper } from './tables';
import { createTasksWrapper } from './tasks';
import { createTenantsWrapper } from './tenants';
import type { AnySupabaseClient, WrapperContext } from './types';
import { createViewsWrapper } from './views';
import { createWaiterCallsWrapper } from './waiter-calls';
import { createWasteWrapper } from './waste';

export class SupabaseWrapper {
  private ctx: WrapperContext;

  // Cached domain wrappers (lazy-initialized)
  private _tables?: ReturnType<typeof createTablesWrapper>;
  private _orders?: ReturnType<typeof createOrdersWrapper>;
  private _orderItems?: ReturnType<typeof createOrderItemsWrapper>;
  private _menuItems?: ReturnType<typeof createMenuItemsWrapper>;
  private _categories?: ReturnType<typeof createCategoriesWrapper>;
  private _staff?: ReturnType<typeof createStaffWrapper>;
  private _feedback?: ReturnType<typeof createFeedbackWrapper>;
  private _payments?: ReturnType<typeof createPaymentsWrapper>;
  private _waiterCalls?: ReturnType<typeof createWaiterCallsWrapper>;
  private _settings?: ReturnType<typeof createSettingsWrapper>;
  private _stockItems?: ReturnType<typeof createStockItemsWrapper>;
  private _expenseCategories?: ReturnType<typeof createExpenseCategoriesWrapper>;
  private _expenses?: ReturnType<typeof createExpensesWrapper>;
  private _schedules?: ReturnType<typeof createSchedulesWrapper>;
  private _waste?: ReturnType<typeof createWasteWrapper>;
  private _tasks?: ReturnType<typeof createTasksWrapper>;
  private _refunds?: ReturnType<typeof createRefundsWrapper>;
  private _tenants?: ReturnType<typeof createTenantsWrapper>;
  private _deliveryCustomers?: ReturnType<typeof createDeliveryCustomersWrapper>;
  private _reports?: ReturnType<typeof createReportsWrapper>;
  private _rpc?: ReturnType<typeof createRpcWrapper>;
  private _views?: ReturnType<typeof createViewsWrapper>;
  private _realtime?: ReturnType<typeof createRealtimeWrapper>;

  constructor(client: SupabaseClient<Database>) {
    this.ctx = {
      client,
      anyClient: client as AnySupabaseClient,
    };
  }

  // Domain wrappers — lazy-initialized on first access
  get tables() {
    if (!this._tables) this._tables = createTablesWrapper(this.ctx);
    return this._tables;
  }
  get orders() {
    if (!this._orders) this._orders = createOrdersWrapper(this.ctx);
    return this._orders;
  }
  get orderItems() {
    if (!this._orderItems) this._orderItems = createOrderItemsWrapper(this.ctx);
    return this._orderItems;
  }
  get menuItems() {
    if (!this._menuItems) this._menuItems = createMenuItemsWrapper(this.ctx);
    return this._menuItems;
  }
  get categories() {
    if (!this._categories) this._categories = createCategoriesWrapper(this.ctx);
    return this._categories;
  }
  get staff() {
    if (!this._staff) this._staff = createStaffWrapper(this.ctx);
    return this._staff;
  }
  get feedback() {
    if (!this._feedback) this._feedback = createFeedbackWrapper(this.ctx);
    return this._feedback;
  }
  get payments() {
    if (!this._payments) this._payments = createPaymentsWrapper(this.ctx);
    return this._payments;
  }
  get waiterCalls() {
    if (!this._waiterCalls) this._waiterCalls = createWaiterCallsWrapper(this.ctx);
    return this._waiterCalls;
  }
  get settings() {
    if (!this._settings) this._settings = createSettingsWrapper(this.ctx);
    return this._settings;
  }
  get stockItems() {
    if (!this._stockItems) this._stockItems = createStockItemsWrapper(this.ctx);
    return this._stockItems;
  }
  get expenseCategories() {
    if (!this._expenseCategories)
      this._expenseCategories = createExpenseCategoriesWrapper(this.ctx);
    return this._expenseCategories;
  }
  get expenses() {
    if (!this._expenses) this._expenses = createExpensesWrapper(this.ctx);
    return this._expenses;
  }
  get schedules() {
    if (!this._schedules) this._schedules = createSchedulesWrapper(this.ctx);
    return this._schedules;
  }
  get waste() {
    if (!this._waste) this._waste = createWasteWrapper(this.ctx);
    return this._waste;
  }
  get tasks() {
    if (!this._tasks) this._tasks = createTasksWrapper(this.ctx);
    return this._tasks;
  }
  get refunds() {
    if (!this._refunds) this._refunds = createRefundsWrapper(this.ctx);
    return this._refunds;
  }
  get tenants() {
    if (!this._tenants) this._tenants = createTenantsWrapper(this.ctx);
    return this._tenants;
  }
  get deliveryCustomers() {
    if (!this._deliveryCustomers)
      this._deliveryCustomers = createDeliveryCustomersWrapper(this.ctx);
    return this._deliveryCustomers;
  }
  get reports() {
    if (!this._reports) this._reports = createReportsWrapper(this.ctx);
    return this._reports;
  }
  get rpc() {
    if (!this._rpc) this._rpc = createRpcWrapper(this.ctx);
    return this._rpc;
  }
  get views() {
    if (!this._views) this._views = createViewsWrapper(this.ctx);
    return this._views;
  }
  get realtime() {
    if (!this._realtime) this._realtime = createRealtimeWrapper(this.ctx);
    return this._realtime;
  }
}

// Export factory function
export function createSupabaseWrapper(client: SupabaseClient<Database>) {
  return new SupabaseWrapper(client);
}

export type { DeliveryCustomersWrapper } from './delivery-customers';
export type { ExpenseCategoriesWrapper, ExpensesWrapper } from './expenses';
export type { FeedbackWrapper } from './feedback';
export type { CategoriesWrapper, MenuItemsWrapper } from './menu';
export type { OrderItemsWrapper, OrdersWrapper } from './orders';
export type { PaymentsWrapper } from './payments';
export type { RealtimeWrapper } from './realtime';
export type { RefundsWrapper } from './refunds';
export type {
  ExpenseSummaryRow,
  ReportsWrapper,
  RevenueSummaryRow,
  StaffPerformanceRow,
  TopSoldItemRow,
  WasteSummaryRow,
} from './reports';
export type { RpcWrapper } from './rpc';
export type { SchedulesWrapper } from './schedules';
export type { SettingsWrapper } from './settings';
export type { StaffWrapper } from './staff';
export type { StockItemsWrapper } from './stock';
export type { TablesWrapper } from './tables';
export type { TasksWrapper } from './tasks';
export type { TenantsWrapper } from './tenants';
// Re-export types
export * from './types';
export type { ViewsWrapper } from './views';
export type { WaiterCallsWrapper } from './waiter-calls';
export type { WasteWrapper } from './waste';
