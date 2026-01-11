// Re-export shared types from database types
export type {
  Database,
  Json,
} from "./database";

import type { Database } from "./database";

// Type aliases for tables
export type Table = Database["public"]["Tables"]["tables"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type WaiterCall = Database["public"]["Tables"]["waiter_calls"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];

// Extended types with relations
export interface OrderWithDetails extends Order {
  table: Pick<Table, "table_number" | "location">;
  order_items: OrderItemWithMenuItem[];
  assigned_waiter?: Pick<Staff, "full_name">;
}

export interface OrderItemWithMenuItem extends OrderItem {
  menu_item?: MenuItem;
}

export interface WaiterCallWithTable extends WaiterCall {
  table: Pick<Table, "table_number" | "location">;
}

// User role type
export type UserRole = Staff["role"];

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Tables: undefined;
  Orders: undefined;
  Menu: undefined;
  Staff: undefined;
  Reports: undefined;
  Profile: undefined;
  Kitchen: undefined;
};

export type TablesStackParamList = {
  TablesList: undefined;
  TableDetail: { tableId: string };
};

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { orderId: string };
};

// Helper type guards
export function isWaiter(staff: Staff): boolean {
  return staff.role === "waiter";
}

export function isAdmin(staff: Staff): boolean {
  return staff.role === "admin";
}

export function isKitchen(staff: Staff): boolean {
  return staff.role === "kitchen";
}


