/**
 * Comprehensive Supabase Wrapper
 * Provides type-safe operations for database operations.
 *
 * Note: Some type assertions are necessary due to Supabase's strict
 * generated types not matching runtime behavior for insert/update operations.
 * The Supabase client requires 'as any' for update/insert operations because
 * the generated types are too strict for practical use.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/database';
import {
  handleSupabaseError,
  isOrder,
  isTable,
  isMenuItem,
  isCustomerFeedback,
  isCategory,
  isStaff,
  isWaiterCall,
  isOrderPayment,
  isOrderItem,
  isTableArray,
  isCategoryArray,
  isStaffArray,
  isOrderItemArray,
} from '@cafe-idare/core';

// Type aliases for cleaner code
type Tables = Database['public']['Tables'];
type TableRow = Tables['tables']['Row'];
type TableInsert = Tables['tables']['Insert'];
type TableUpdate = Tables['tables']['Update'];
type OrderRow = Tables['orders']['Row'];
type OrderInsert = Tables['orders']['Insert'];
type OrderItemInsert = Tables['order_items']['Insert'];
type OrderItemRow = Tables['order_items']['Row'];
type MenuItemInsert = Tables['menu_items']['Insert'];
type MenuItemUpdate = Tables['menu_items']['Update'];
type CategoryInsert = Tables['categories']['Insert'];
type CategoryUpdate = Tables['categories']['Update'];
type CustomerFeedbackRow = Tables['customer_feedback']['Row'];
type OrderPaymentInsert = Tables['order_payments']['Insert'];
type StaffInsert = Tables['staff']['Insert'];
type StaffUpdate = Tables['staff']['Update'];
type WaiterCallRow = Tables['waiter_calls']['Row'];

// Helper type for Supabase client that bypasses strict typing
type AnySupabaseClient = SupabaseClient<any>;

export class SupabaseWrapper {
  private anyClient: AnySupabaseClient;

  constructor(private client: SupabaseClient<Database>) {
    // Cast to any client to bypass strict Supabase typing for mutations
    this.anyClient = client as AnySupabaseClient;
  }

  // ========== TABLES ==========
  tables = {
    findAll: async () => {
      const { data, error } = await this.client
        .from('tables')
        .select('*')
        .order('table_number');

      if (error) throw handleSupabaseError(error);
      const tables = data || [];
      if (!isTableArray(tables)) throw new Error('Invalid tables data');
      return tables;
    },

    findById: async (id: string) => {
      const { data, error } = await this.client
        .from('tables')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByQrCode: async (qrCode: string) => {
      const { data, error } = await this.client
        .from('tables')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    updateStatus: async (id: string, status: TableRow['status']) => {
      const { data, error } = await this.anyClient
        .from('tables')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    create: async (tableData: TableInsert) => {
      const { data, error } = await this.anyClient
        .from('tables')
        .insert(tableData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    update: async (id: string, updates: TableUpdate) => {
      const { data, error } = await this.anyClient
        .from('tables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    delete: async (id: string) => {
      const { error } = await this.anyClient
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== ORDERS ==========
  orders = {
    findAll: async (filters?: {
      status?: OrderRow['status'];
      table_id?: string;
      order_type?: OrderRow['order_type'];
    }) => {
      let query = this.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.table_id) {
        query = query.eq('table_id', filters.table_id);
      }
      if (filters?.order_type) {
        query = query.eq('order_type', filters.order_type);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await this.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number, location),
          order_items(
            *,
            menu_item:menu_items(*)
          ),
          assigned_waiter:staff!orders_assigned_waiter_id_fkey(full_name),
          order_payments(
            *,
            received_by_staff:staff!order_payments_received_by_fkey(full_name)
          ),
          table_transfers(
            *,
            from_table:tables!table_transfers_from_table_id_fkey(table_number),
            to_table:tables!table_transfers_to_table_id_fkey(table_number),
            transferred_by_staff:staff!table_transfers_transferred_by_fkey(full_name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data;
    },

    create: async (orderData: OrderInsert) => {
      const { data, error } = await this.anyClient
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    updateStatus: async (id: string, status: OrderRow['status']) => {
      const { data, error } = await this.anyClient
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    getActiveOrders: async () => {
      const { data, error } = await this.client
        .from('orders')
        .select(`
          *,
          table:tables!orders_table_id_fkey(table_number),
          order_items(count)
        `)
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    assignWaiter: async (orderId: string, waiterId: string | null) => {
      const { data, error } = await this.anyClient
        .from('orders')
        .update({ assigned_waiter_id: waiterId })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },
  };

  // ========== ORDER ITEMS ==========
  orderItems = {
    create: async (items: OrderItemInsert[]) => {
      const { data, error } = await this.anyClient
        .from('order_items')
        .insert(items)
        .select();

      if (error) throw handleSupabaseError(error);
      const orderItems = data || [];
      if (!isOrderItemArray(orderItems)) throw new Error('Invalid order items data');
      return orderItems as OrderItemRow[];
    },

    updateStatus: async (id: string, status: OrderItemRow['status']) => {
      const { data, error } = await this.anyClient
        .from('order_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data as OrderItemRow;
    },

    delete: async (id: string) => {
      const { error } = await this.anyClient
        .from('order_items')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== MENU ITEMS ==========
  menuItems = {
    findAll: async (options?: {
      categoryId?: string;
      isAvailable?: boolean;
      isPopular?: boolean;
    }) => {
      let query = this.client
        .from('menu_items')
        .select(`
          *,
          category:categories(*)
        `)
        .order('display_order');

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.isAvailable !== undefined) {
        query = query.eq('is_available', options.isAvailable);
      }
      if (options?.isPopular !== undefined) {
        query = query.eq('is_popular', options.isPopular);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await this.client
        .from('menu_items')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    update: async (id: string, updates: Partial<MenuItemUpdate>) => {
      const { data, error } = await this.anyClient
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    create: async (itemData: MenuItemInsert) => {
      const { data, error } = await this.anyClient
        .from('menu_items')
        .insert(itemData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    toggleAvailability: async (id: string) => {
      // First get current state
      const { data: current, error: fetchError } = await this.anyClient
        .from('menu_items')
        .select('is_available')
        .eq('id', id)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);
      if (!current) throw new Error('Menu item not found');

      // Toggle the state
      const { data, error } = await this.anyClient
        .from('menu_items')
        .update({ is_available: !(current as { is_available: boolean }).is_available })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.anyClient
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== CATEGORIES ==========
  categories = {
    findAll: async () => {
      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .order('display_order');

      if (error) throw handleSupabaseError(error);
      const categories = data || [];
      if (!isCategoryArray(categories)) throw new Error('Invalid categories data');
      return categories;
    },

    create: async (categoryData: CategoryInsert) => {
      const { data, error } = await this.anyClient
        .from('categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    update: async (id: string, updates: Partial<CategoryUpdate>) => {
      const { data, error } = await this.anyClient
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.anyClient
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== CUSTOMER FEEDBACK ==========
  feedback = {
    findAll: async (status?: CustomerFeedbackRow['status']) => {
      let query = this.client
        .from('customer_feedback')
        .select(`
          *,
          table:tables!customer_feedback_table_id_fkey(table_number),
          responded_by_staff:staff!customer_feedback_responded_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    acknowledge: async (id: string, staffId: string) => {
      const { data, error } = await this.anyClient
        .from('customer_feedback')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    respond: async (id: string, staffId: string, response: string, status: CustomerFeedbackRow['status']) => {
      const { data, error } = await this.anyClient
        .from('customer_feedback')
        .update({
          status,
          responded_by: staffId,
          response,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    dismiss: async (id: string) => {
      const { data, error } = await this.anyClient
        .from('customer_feedback')
        .update({ status: 'dismissed' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data as CustomerFeedbackRow;
    },

    getPendingCount: async () => {
      const { count, error } = await this.client
        .from('customer_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw handleSupabaseError(error);
      return count || 0;
    },
  };

  // ========== PAYMENTS ==========
  payments = {
    create: async (paymentData: OrderPaymentInsert) => {
      const { data, error } = await this.anyClient
        .from('order_payments')
        .insert(paymentData)
        .select(`
          *,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderPayment(data)) throw new Error('Invalid payment data');
      return data;
    },

    findByOrderId: async (orderId: string) => {
      const { data, error } = await this.client
        .from('order_payments')
        .select(`
          *,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };

  // ========== STAFF ==========
  staff = {
    findAll: async (role?: string) => {
      let query = this.client
        .from('staff')
        .select('*')
        .order('full_name');

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      const staff = data || [];
      if (!isStaffArray(staff)) throw new Error('Invalid staff data');
      return staff;
    },

    findById: async (id: string) => {
      const { data, error } = await this.client
        .from('staff')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByEmail: async (email: string) => {
      const { data, error } = await this.client
        .from('staff')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByAuthId: async (authUserId: string) => {
      const { data, error } = await this.client
        .from('staff')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    create: async (staffData: StaffInsert) => {
      const { data, error } = await this.anyClient
        .from('staff')
        .insert(staffData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    update: async (id: string, updates: StaffUpdate) => {
      const { data, error } = await this.anyClient
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.anyClient
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    getActiveWaiters: async () => {
      const { data, error } = await this.client
        .from('staff')
        .select('*')
        .eq('role', 'waiter')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw handleSupabaseError(error);
      const waiters = data || [];
      if (!isStaffArray(waiters)) throw new Error('Invalid staff data');
      return waiters;
    },
  };

  // ========== WAITER CALLS ==========
  waiterCalls = {
    findAll: async (status?: WaiterCallRow['status']) => {
      let query = this.client
        .from('waiter_calls')
        .select(`
          *,
          table:tables!waiter_calls_table_id_fkey(table_number, location)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    acknowledge: async (id: string, staffId: string) => {
      const { data, error } = await this.anyClient
        .from('waiter_calls')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    resolve: async (id: string, notes?: string) => {
      const { data, error } = await this.anyClient
        .from('waiter_calls')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data as WaiterCallRow;
    },

    getPendingCount: async () => {
      const { count, error } = await this.client
        .from('waiter_calls')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw handleSupabaseError(error);
      return count || 0;
    },
  };

  // ========== RPC FUNCTIONS ==========
  rpc = {
    getRemainingBalance: async (orderId: string): Promise<number> => {
      const { data, error } = await this.anyClient
        .rpc('get_order_remaining_balance', { order_uuid: orderId });

      if (error) throw handleSupabaseError(error);
      return (data as number) || 0;
    },

    transferTable: async (params: {
      orderId: string;
      fromTableId: string;
      toTableId: string;
      staffId: string;
      reason?: string;
    }): Promise<boolean> => {
      const { data, error } = await this.anyClient
        .rpc('transfer_table', {
          p_order_id: params.orderId,
          p_from_table_id: params.fromTableId,
          p_to_table_id: params.toTableId,
          p_staff_id: params.staffId,
          p_reason: params.reason
        });

      if (error) throw handleSupabaseError(error);
      return (data as boolean) || false;
    },

    generateOrderNumber: async (): Promise<string> => {
      const { data, error } = await this.anyClient
        .rpc('generate_order_number');

      if (error) throw handleSupabaseError(error);
      return (data as string) || '';
    },
  };

  // ========== VIEWS ==========
  views = {
    getActiveOrders: async () => {
      const { data, error } = await this.anyClient
        .from('active_orders_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getSalesSummary: async (startDate?: string, endDate?: string) => {
      let query = this.anyClient
        .from('sales_summary_view')
        .select('*')
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getOrderPaymentSummary: async (orderId?: string) => {
      let query = this.anyClient
        .from('order_payment_summary')
        .select('*');

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };

  // ========== REALTIME ==========
  realtime = {
    subscribeToTables: (callback: (payload: any) => void) => {
      return this.client
        .channel('tables-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tables' },
          callback
        )
        .subscribe();
    },

    subscribeToOrders: (callback: (payload: any) => void) => {
      return this.client
        .channel('orders-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          callback
        )
        .subscribe();
    },

    subscribeToWaiterCalls: (callback: (payload: any) => void) => {
      return this.client
        .channel('waiter-calls-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waiter_calls' },
          callback
        )
        .subscribe();
    },

    unsubscribe: (channel: any) => {
      return this.client.removeChannel(channel);
    },
  };

  // ========== AUTH ==========
  // Note: Auth operations should be accessed directly from the Supabase client
  // to avoid TypeScript declaration issues with private properties
}

// Export a factory function
export function createSupabaseWrapper(client: SupabaseClient<Database>) {
  return new SupabaseWrapper(client);
}
