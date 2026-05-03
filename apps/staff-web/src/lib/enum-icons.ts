/**
 * Typed enum → lucide icon Records.
 *
 * Mirror of `@gustri/ui`'s badge maps but for icons. Lives in staff-web (not
 * `@gustri/ui`) because `@gustri/ui` shouldn't depend on `lucide-react` —
 * other apps may use a different icon set.
 *
 * Each map is `Record<EnumType, LucideIcon>`, so adding a new variant to the
 * underlying enum fails `pnpm type-check` until every icon table is updated.
 * Consumers render via `<Icon className="h-4 w-4" />` for context-specific
 * sizing.
 */

import type {
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  TableStatus,
  UserRole,
} from '@gustri/database';
import {
  AlertCircle,
  Banknote,
  CheckCircle,
  ChefHat,
  CreditCard,
  Hourglass,
  type LucideIcon,
  Shield,
  Smartphone,
  Truck,
  User,
  UserCheck,
  Users,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

export const ORDER_STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  pending_approval: Hourglass,
  new: AlertCircle,
  preparing: ChefHat,
  ready: CheckCircle,
  served: UtensilsCrossed,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  closed: CheckCircle,
  cancelled: XCircle,
};

export const ORDER_ITEM_STATUS_ICONS: Record<OrderItemStatus, LucideIcon> = {
  pending: AlertCircle,
  preparing: ChefHat,
  ready: CheckCircle,
  served: UtensilsCrossed,
  cancelled: XCircle,
};

export const USER_ROLE_ICONS: Record<UserRole, LucideIcon> = {
  owner: UserCheck,
  admin: Shield,
  kitchen: ChefHat,
  waiter: User,
};

export const TABLE_STATUS_ICONS: Record<TableStatus, LucideIcon> = {
  free: CheckCircle,
  occupied: Users,
  reserved: Hourglass,
  closed: XCircle,
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  digital: Smartphone,
};
