// Re-export shared types from packages (single source of truth)
export type {
  Category,
  CustomerFeedback,
  Database,
  Expense,
  ExpenseCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderItemWithMenuItem,
  OrderPayment,
  OrderWithDetails,
  Staff,
  StaffSchedule,
  StockItem,
  StockMovement,
  Table,
  Task,
  WaiterCall,
  WaiterCallWithTable,
  WasteLog,
} from '@cafe-idare/database';

import type { Staff } from '@cafe-idare/database';

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
