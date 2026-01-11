/**
 * Staff Web Types
 * Re-export from shared types for convenience
 */

import type * as DB from '@cafe-idare/database';

// Re-export all database types
export * from '@cafe-idare/database';

// Re-export constants from core
export {
  QUERY_KEYS,
  ORDER_STATUS,
  TABLE_STATUS,
  USER_ROLE,
  ORDER_ITEM_STATUS,
  WAITER_CALL_STATUS,
  TAX_RATE,
  REFRESH_INTERVALS,
  STATUS_COLORS,
  STORAGE_KEYS
} from '@cafe-idare/core';

// Local extended types specific to staff-web
export interface OrderWithDetails extends DB.Order {
  table: Pick<DB.Tables, 'table_number' | 'location'>;
  order_items: Array<DB.OrderItem & {
    menu_item?: DB.MenuItems;
  }>;
  assigned_waiter?: Pick<DB.Staff, 'full_name'>;
}
