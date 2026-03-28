/**
 * Staff Web Types
 * Re-export from shared types for convenience
 */

import type * as DB from '@gustri/database';

// Re-export constants from core
export {
  ORDER_ITEM_STATUS,
  ORDER_STATUS,
  QUERY_KEYS,
  REFRESH_INTERVALS,
  STATUS_COLORS,
  STORAGE_KEYS,
  TABLE_STATUS,
  TAX_RATE,
  USER_ROLE,
  WAITER_CALL_STATUS,
} from '@gustri/core';
// Re-export all database types
export * from '@gustri/database';

// Local extended types specific to staff-web
export interface OrderWithDetails extends DB.Order {
  table: Pick<DB.Tables, 'table_number' | 'location'>;
  order_items: Array<
    DB.OrderItem & {
      menu_item?: DB.MenuItems;
    }
  >;
  assigned_waiter?: Pick<DB.Staff, 'full_name'>;
}
