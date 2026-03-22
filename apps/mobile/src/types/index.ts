// Re-export shared types from database package
export type { Database } from '@cafe-idare/database';

import type { Database } from '@cafe-idare/database';

// Type aliases for tables
export type Table = Database['public']['Tables']['tables']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type WaiterCall = Database['public']['Tables']['waiter_calls']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];

// Extended types with relations
export interface OrderWithDetails extends Order {
  table: Pick<Table, 'table_number' | 'location'>;
  order_items: OrderItemWithMenuItem[];
  assigned_waiter?: Pick<Staff, 'full_name'>;
}

export interface OrderItemWithMenuItem extends OrderItem {
  menu_item?: MenuItem;
}

export interface WaiterCallWithTable extends WaiterCall {
  table: Pick<Table, 'table_number' | 'location'>;
}

// User role type
export type UserRole = Staff['role'];

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  TablesTab: undefined;
  OrdersTab: undefined;
  KitchenTab: undefined;
  CallsTab: undefined;
  ProfileTab: undefined;
};

export type TablesStackParamList = {
  TablesList: undefined;
  TableDetail: { tableId: string };
};

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { orderId: string };
  AddItems: { orderId: string };
  OrderPayment: { orderId: string };
};

export type KitchenStackParamList = {
  KitchenDisplay: undefined;
};

export type CallsStackParamList = {
  WaiterCallsList: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};

// Drawer navigation
export type DrawerParamList = {
  Home: undefined;
  DeliveryTab: undefined;
  TasksTab: undefined;
  FeedbackTab: undefined;
  StockTab: undefined;
  WasteTab: undefined;
  ExpensesTab: undefined;
  StaffManagementTab: undefined;
  MenuManagementTab: undefined;
  SchedulesTab: undefined;
  ReportsTab: undefined;
  CafeSettingsTab: undefined;
};

// New stack param lists
export type DeliveryStackParamList = {
  DeliveryList: undefined;
};

export type TasksStackParamList = {
  TasksList: undefined;
};

export type FeedbackStackParamList = {
  FeedbackList: undefined;
};

export type StockStackParamList = {
  StockList: undefined;
};

export type WasteStackParamList = {
  WasteList: undefined;
};

export type ExpensesStackParamList = {
  ExpensesList: undefined;
};

export type StaffManagementStackParamList = {
  StaffList: undefined;
  StaffDetail: { staffId: string };
};

export type MenuManagementStackParamList = {
  MenuManagement: undefined;
};

export type SchedulesStackParamList = {
  Schedules: undefined;
};

export type ReportsStackParamList = {
  Reports: undefined;
};

export type CafeSettingsStackParamList = {
  CafeSettings: undefined;
};
