import type { Database } from '@gustri/database';

// Type aliases for easier use
export type Table = Database['public']['Tables']['tables']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type WaiterCall = Database['public']['Tables']['waiter_calls']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];

// Re-export from shared package (avoid local duplicates)
export type { MenuItemWithCategory } from '@gustri/database';

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table: Pick<Table, 'table_number' | 'location'>;
}

export type { DeliveryOrderWithDetails } from '@gustri/database';

export interface OrderItemWithMenuItem extends OrderItem {
  menu_item: MenuItem;
}

// Cart item (client-side only)
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

// Order status type
export type OrderStatus = Order['status'];

// Table status type
export type TableStatus = Table['status'];
