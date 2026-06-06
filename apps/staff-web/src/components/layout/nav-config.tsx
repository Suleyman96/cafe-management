import type { PlanName } from '@gustri/core';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ListTodo,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Scale,
  Store,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

export type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  minPlan?: PlanName;
};

export type NavGroup = {
  key: string;
  labelKey: string;
  collapsible: boolean;
  adminOnly?: boolean;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    key: 'main',
    labelKey: 'mainSection',
    collapsible: false,
    items: [
      { href: '/tables', labelKey: 'tables', icon: <UtensilsCrossed className="h-5 w-5" /> },
      { href: '/orders', labelKey: 'orders', icon: <ClipboardList className="h-5 w-5" /> },
      { href: '/delivery', labelKey: 'delivery', icon: <Truck className="h-5 w-5" /> },
      { href: '/takeout', labelKey: 'takeout', icon: <Package className="h-5 w-5" /> },
      { href: '/kitchen', labelKey: 'kitchen', icon: <ChefHat className="h-5 w-5" /> },
      { href: '/calls', labelKey: 'waiterCalls', icon: <Bell className="h-5 w-5" /> },
      {
        href: '/tasks',
        labelKey: 'tasks',
        icon: <ListTodo className="h-5 w-5" />,
        minPlan: 'pro' as PlanName,
      },
    ],
  },
  {
    key: 'management',
    labelKey: 'managementSection',
    collapsible: true,
    items: [
      {
        href: '/feedback',
        labelKey: 'feedback',
        icon: <MessageSquare className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: '/stock',
        labelKey: 'stock',
        icon: <Package className="h-5 w-5" />,
        adminOnly: true,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/waste',
        labelKey: 'waste',
        icon: <Trash2 className="h-5 w-5" />,
        adminOnly: true,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/expenses',
        labelKey: 'expenses',
        icon: <Receipt className="h-5 w-5" />,
        adminOnly: true,
      },
    ],
  },
  {
    key: 'admin',
    labelKey: 'adminSection',
    collapsible: true,
    adminOnly: true,
    items: [
      { href: '/staff', labelKey: 'staff', icon: <Users className="h-5 w-5" /> },
      { href: '/menu', labelKey: 'menu', icon: <Menu className="h-5 w-5" /> },
      {
        href: '/schedules',
        labelKey: 'schedules',
        icon: <CalendarDays className="h-5 w-5" />,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/reports',
        labelKey: 'reports',
        icon: <BarChart3 className="h-5 w-5" />,
        ownerOnly: true,
      },
      {
        href: '/reports/shift-reconciliation',
        labelKey: 'reconciliation',
        icon: <Scale className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: '/cafe-settings',
        labelKey: 'cafeSettings',
        icon: <Store className="h-5 w-5" />,
      },
    ],
  },
];
