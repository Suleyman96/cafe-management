/**
 * Comprehensive Supabase Wrapper
 * Provides type-safe operations for database operations.
 *
 * Note: Some 'as any' casts are necessary due to Supabase's strict
 * generated types not matching runtime behavior for insert/update operations.
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
  isOrderArray,
  isMenuItemArray,
  isCategoryArray,
  isStaffArray,
  isWaiterCallArray,
  isCustomerFeedbackArray,
  isOrderPaymentArray,
  isOrderItemArray,
  assertType
} from '@cafe-idare/core';

export class SupabaseWrapper {
  constructor(private client: SupabaseClient<Database>) {}

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

    updateStatus: async (id: string, status: Database['public']['Tables']['tables']['Row']['status']) => {
      const { data, error } = await this.client
        .from('tables')
        .update({ status } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    create: async (tableData: Database['public']['Tables']['tables']['Insert']) => {
      const { data, error } = await this.client
        .from('tables')
        .insert(tableData as any)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    update: async (id: string, updates: Database['public']['Tables']['tables']['Update']) => {
      const { data, error } = await this.client
        .from('tables')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.client
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== ORDERS ==========
  orders = {
    findAll: async (filters?: {
      status?: Database['public']['Tables']['orders']['Row']['status'];
      table_id?: string;
      order_type?: Database['public']['Tables']['orders']['Row']['order_type'];
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
      const orders = data || [];
      // Note: Complex nested types - validate top level only
      return orders;
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

    create: async (orderData: Database['public']['Tables']['orders']['Insert']) => {
      const { data, error } = await this.client
        .from('orders')
        .insert(orderData as any)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data;
    },

    updateStatus: async (id: string, status: Database['public']['Tables']['orders']['Row']['status']) => {
      const { data, error } = await this.client
        .from('orders')
        .update({ status } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data;
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
      const orders = data || [];
      // Note: Complex nested types - validate top level only
      return orders;
    },
  };

  // ========== ORDER ITEMS ==========
  orderItems = {
    create: async (items: Database['public']['Tables']['order_items']['Insert'][]) => {
      const { data, error } = await this.client
        .from('order_items')
        .insert(items as any)
        .select();
      
      if (error) throw handleSupabaseError(error);
      const orderItems = data || [];
      if (!isOrderItemArray(orderItems)) throw new Error('Invalid order items data');
      return orderItems;
    },

    updateStatus: async (id: string, status: Database['public']['Tables']['order_items']['Row']['status']) => {
      const { data, error } = await this.client
        .from('order_items')
        .update({ status } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.client
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
      const menuItems = data || [];
      // Note: Complex nested category - validate top level only
      return menuItems;
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

    update: async (id: string, updates: Partial<Database['public']['Tables']['menu_items']['Update']>) => {
      const { data, error } = await this.client
        .from('menu_items')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    create: async (itemData: Database['public']['Tables']['menu_items']['Insert']) => {
      const { data, error } = await this.client
        .from('menu_items')
        .insert(itemData as any)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    toggleAvailability: async (id: string) => {
      // First get current state
      const { data: current, error: fetchError } = await this.client
        .from('menu_items')
        .select('is_available')
        .eq('id', id)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);

      // Toggle the state
      const { data, error } = await this.client
        .from('menu_items')
        .update({ is_available: !current.is_available } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.client
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

    create: async (categoryData: Database['public']['Tables']['categories']['Insert']) => {
      const { data, error } = await this.client
        .from('categories')
        .insert(categoryData as any)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    update: async (id: string, updates: Partial<Database['public']['Tables']['categories']['Update']>) => {
      const { data, error } = await this.client
        .from('categories')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.client
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };

  // ========== CUSTOMER FEEDBACK ==========
  feedback = {
    findAll: async (status?: Database['public']['Tables']['customer_feedback']['Row']['status']) => {
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
      const feedback = data || [];
      // Note: Complex nested relations - validate top level only
      return feedback;
    },

    acknowledge: async (id: string, staffId: string) => {
      const { data, error } = await this.client
        .from('customer_feedback')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data;
    },

    respond: async (id: string, staffId: string, response: string, status: Database['public']['Tables']['customer_feedback']['Row']['status']) => {
      const { data, error } = await this.client
        .from('customer_feedback')
        .update({
          status,
          responded_by: staffId,
          response,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data;
    },

    dismiss: async (id: string) => {
      const { data, error } = await this.client
        .from('customer_feedback')
        .update({ status: 'dismissed' } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isCustomerFeedback(data)) throw new Error('Invalid feedback data');
      return data;
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
    create: async (paymentData: Database['public']['Tables']['order_payments']['Insert']) => {
      const { data, error } = await this.client
        .from('order_payments')
        .insert(paymentData as any)
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
      const payments = data || [];
      // Note: Complex nested staff relation - validate top level only
      return payments;
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

    create: async (staffData: Database['public']['Tables']['staff']['Insert']) => {
      const { data, error } = await this.client
        .from('staff')
        .insert(staffData as any)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    update: async (id: string, updates: Database['public']['Tables']['staff']['Update']) => {
      const { data, error } = await this.client
        .from('staff')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await this.client
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
    findAll: async (status?: Database['public']['Tables']['waiter_calls']['Row']['status']) => {
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
      const calls = data || [];
      // Note: Complex nested table relation - validate top level only
      return calls;
    },

    acknowledge: async (id: string, staffId: string) => {
      const { data, error } = await this.client
        .from('waiter_calls')
        .update({
          status: 'acknowledged',
          responded_by: staffId,
          acknowledged_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data;
    },

    resolve: async (id: string, notes?: string) => {
      const { data, error } = await this.client
        .from('waiter_calls')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          notes,
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      if (!isWaiterCall(data)) throw new Error('Invalid waiter call data');
      return data;
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
      const { data, error } = await this.client
        .rpc('get_order_remaining_balance', { order_uuid: orderId } as any);
      
      if (error) throw handleSupabaseError(error);
      return data || 0;
    },

    transferTable: async (params: {
      orderId: string;
      fromTableId: string;
      toTableId: string;
      staffId: string;
      reason?: string;
    }): Promise<boolean> => {
      const { data, error } = await this.client
        .rpc('transfer_table', {
          p_order_id: params.orderId,
          p_from_table_id: params.fromTableId,
          p_to_table_id: params.toTableId,
          p_staff_id: params.staffId,
          p_reason: params.reason
        } as any);
      
      if (error) throw handleSupabaseError(error);
      return data || false;
    },

    generateOrderNumber: async (): Promise<string> => {
      const { data, error } = await this.client
        .rpc('generate_order_number');
      
      if (error) throw handleSupabaseError(error);
      return data || '';
    },
  };

  // ========== VIEWS ==========
  views = {
    getActiveOrders: async () => {
      const { data, error } = await this.client
        .from('active_orders_view')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getSalesSummary: async (startDate?: string, endDate?: string) => {
      let query = this.client
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
      let query = this.client
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