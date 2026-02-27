import type { Database } from '@cafe-idare/database';

// Type aliases for easier use
export type Table = Database['public']['Tables']['tables']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type WaiterCall = Database['public']['Tables']['waiter_calls']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];

// Extended types with relations
export interface MenuItemWithCategory extends MenuItem {
  category: Category | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table: Pick<Table, 'table_number' | 'location'>;
}

export interface OrderItemWithMenuItem extends OrderItem {
  menu_item: MenuItem;
}

// Cart item (client-side only)
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

// Helper to get localized field from a menu item or category
// Currently DB has single-language fields (name, description),
// so this returns the field directly with a fallback to empty string.
export function getLocalizedField(
  item: Record<string, any>,
  field: 'name' | 'description',
  _language?: string,
): string {
  return (item?.[field] as string) ?? '';
}

// Order status type
export type OrderStatus = Order['status'];

// Table status type
export type TableStatus = Table['status'];
