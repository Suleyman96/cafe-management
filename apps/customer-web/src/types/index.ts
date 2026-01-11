import type { Database } from "./database";

// Type aliases for easier use
export type Table = Database["public"]["Tables"]["tables"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type WaiterCall = Database["public"]["Tables"]["waiter_calls"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];

// Extended types with relations
export interface MenuItemWithCategory extends MenuItem {
  category: Category | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table: Pick<Table, "table_number" | "location">;
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

// Language codes
export type Language = "en" | "az" | "ru" | "tr";

// Order status type
export type OrderStatus = Order["status"];

// Table status type
export type TableStatus = Table["status"];

// Localized content helper
export type LocalizedField<T, K extends string> = K extends keyof T ? T[K] : never;

export function getLocalizedField<T>(
  item: T,
  field: string,
  language: Language
): string {
  const key = `${field}_${language}` as keyof T;
  return (item[key] as string) || (item[`${field}_en` as keyof T] as string) || "";
}


