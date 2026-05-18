import { describe, expect, it } from 'vitest';
import {
  CURRENCY_POSITION,
  DISCOUNT_TYPE,
  EXPENSE_PAYMENT_METHOD,
  FEEDBACK_STATUS,
  FEEDBACK_TYPE,
  ORDER_ITEM_STATUS,
  ORDER_SOURCE,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  REFUND_METHOD,
  SCHEDULE_STATUS,
  STOCK_MOVEMENT_TYPE,
  TABLE_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  TASK_STATUS,
  USER_ROLE,
  WAITER_CALL_PRIORITY,
  WAITER_CALL_REASON,
  WAITER_CALL_STATUS,
  WASTE_REASON,
} from '../enums';
import {
  CafeSettingsSchema,
  CurrencyPositionSchema,
  CustomerFeedbackSchema,
  DiscountTypeSchema,
  ExpensePaymentMethodSchema,
  ExpenseSchema,
  FeedbackStatusSchema,
  FeedbackTypeSchema,
  MenuItemSchema,
  OrderItemSchema,
  OrderItemStatusSchema,
  OrderPaymentSchema,
  OrderSchema,
  OrderSourceSchema,
  OrderStatusSchema,
  OrderTypeSchema,
  PaymentMethodSchema,
  PaymentTypeSchema,
  RefundMethodSchema,
  RefundSchema,
  ScheduleStatusSchema,
  StaffScheduleSchema,
  StaffSchema,
  StockItemSchema,
  StockMovementSchema,
  StockMovementTypeSchema,
  TableSchema,
  TableStatusSchema,
  TableTransferSchema,
  TaskPrioritySchema,
  TaskRecurrenceSchema,
  TaskSchema,
  TaskStatusSchema,
  UserRoleSchema,
  WaiterCallPrioritySchema,
  WaiterCallSchema,
  WaiterCallStatusSchema,
  WaiterCallTypeSchema,
  WasteLogSchema,
  WasteReasonSchema,
} from '../schemas';

const uuid1 = '123e4567-e89b-12d3-a456-426614174000';
const uuid2 = '123e4567-e89b-12d3-a456-426614174001';
const now = new Date().toISOString();

// ─── Enum Validation Tests ───────────────────────────────────────

describe('Enum Schemas', () => {
  describe('OrderStatusSchema', () => {
    it('should accept all ORDER_STATUS enum values', () => {
      for (const status of Object.values(ORDER_STATUS)) {
        expect(OrderStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(OrderStatusSchema.safeParse('paid').success).toBe(false);
      expect(OrderStatusSchema.safeParse('completed').success).toBe(false);
      expect(OrderStatusSchema.safeParse('').success).toBe(false);
    });

    it('should have all 9 statuses', () => {
      expect(Object.values(ORDER_STATUS)).toHaveLength(9);
    });
  });

  describe('OrderSourceSchema', () => {
    it('should accept all ORDER_SOURCE values', () => {
      for (const source of Object.values(ORDER_SOURCE)) {
        expect(OrderSourceSchema.safeParse(source).success).toBe(true);
      }
    });

    it('should reject invalid source', () => {
      expect(OrderSourceSchema.safeParse('mobile').success).toBe(false);
    });
  });

  describe('OrderTypeSchema', () => {
    it('should accept all ORDER_TYPE values', () => {
      for (const type of Object.values(ORDER_TYPE)) {
        expect(OrderTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('should reject invalid type', () => {
      expect(OrderTypeSchema.safeParse('pickup').success).toBe(false);
    });
  });

  describe('OrderItemStatusSchema', () => {
    it('should accept all ORDER_ITEM_STATUS values', () => {
      for (const status of Object.values(ORDER_ITEM_STATUS)) {
        expect(OrderItemStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(OrderItemStatusSchema.safeParse('completed').success).toBe(false);
    });
  });

  describe('TableStatusSchema', () => {
    it('should accept all TABLE_STATUS values', () => {
      for (const status of Object.values(TABLE_STATUS)) {
        expect(TableStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(TableStatusSchema.safeParse('dirty').success).toBe(false);
    });
  });

  describe('UserRoleSchema', () => {
    it('should accept all USER_ROLE values including owner', () => {
      for (const role of Object.values(USER_ROLE)) {
        expect(UserRoleSchema.safeParse(role).success).toBe(true);
      }
    });

    it('should have 4 roles including owner', () => {
      expect(Object.values(USER_ROLE)).toHaveLength(4);
      expect(USER_ROLE.OWNER).toBe('owner');
    });

    it('should reject invalid role', () => {
      expect(UserRoleSchema.safeParse('manager').success).toBe(false);
    });
  });

  describe('WaiterCallStatusSchema', () => {
    it('should accept all WAITER_CALL_STATUS values', () => {
      for (const status of Object.values(WAITER_CALL_STATUS)) {
        expect(WaiterCallStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it('should reject "completed" (old wrong value)', () => {
      expect(WaiterCallStatusSchema.safeParse('completed').success).toBe(false);
    });
  });

  describe('WaiterCallTypeSchema', () => {
    it('should accept all WAITER_CALL_REASON values', () => {
      for (const reason of Object.values(WAITER_CALL_REASON)) {
        expect(WaiterCallTypeSchema.safeParse(reason).success).toBe(true);
      }
    });
  });

  describe('WaiterCallPrioritySchema', () => {
    it('should accept all WAITER_CALL_PRIORITY values', () => {
      for (const priority of Object.values(WAITER_CALL_PRIORITY)) {
        expect(WaiterCallPrioritySchema.safeParse(priority).success).toBe(true);
      }
    });
  });

  describe('FeedbackTypeSchema', () => {
    it('should accept all FEEDBACK_TYPE values', () => {
      for (const type of Object.values(FEEDBACK_TYPE)) {
        expect(FeedbackTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('should reject invalid values', () => {
      expect(FeedbackTypeSchema.safeParse('complaint_food').success).toBe(false);
      expect(FeedbackTypeSchema.safeParse('question').success).toBe(false);
      expect(FeedbackTypeSchema.safeParse('request').success).toBe(false);
    });

    it('should have 2 feedback types', () => {
      expect(Object.values(FEEDBACK_TYPE)).toHaveLength(2);
    });
  });

  describe('FeedbackStatusSchema', () => {
    it('should accept all FEEDBACK_STATUS values', () => {
      for (const status of Object.values(FEEDBACK_STATUS)) {
        expect(FeedbackStatusSchema.safeParse(status).success).toBe(true);
      }
    });
  });

  describe('PaymentMethodSchema', () => {
    it('should accept all PAYMENT_METHOD values', () => {
      for (const method of Object.values(PAYMENT_METHOD)) {
        expect(PaymentMethodSchema.safeParse(method).success).toBe(true);
      }
    });
  });

  describe('PaymentTypeSchema', () => {
    it('should accept all PAYMENT_TYPE values', () => {
      for (const type of Object.values(PAYMENT_TYPE)) {
        expect(PaymentTypeSchema.safeParse(type).success).toBe(true);
      }
    });
  });

  describe('StockMovementTypeSchema', () => {
    it('should accept all STOCK_MOVEMENT_TYPE values', () => {
      for (const type of Object.values(STOCK_MOVEMENT_TYPE)) {
        expect(StockMovementTypeSchema.safeParse(type).success).toBe(true);
      }
    });
  });

  describe('ExpensePaymentMethodSchema', () => {
    it('should accept all EXPENSE_PAYMENT_METHOD values', () => {
      for (const method of Object.values(EXPENSE_PAYMENT_METHOD)) {
        expect(ExpensePaymentMethodSchema.safeParse(method).success).toBe(true);
      }
    });
  });

  describe('WasteReasonSchema', () => {
    it('should accept all WASTE_REASON values', () => {
      for (const reason of Object.values(WASTE_REASON)) {
        expect(WasteReasonSchema.safeParse(reason).success).toBe(true);
      }
    });

    it('should have 7 reasons', () => {
      expect(Object.values(WASTE_REASON)).toHaveLength(7);
    });
  });

  describe('TaskStatusSchema', () => {
    it('should accept all TASK_STATUS values', () => {
      for (const status of Object.values(TASK_STATUS)) {
        expect(TaskStatusSchema.safeParse(status).success).toBe(true);
      }
    });
  });

  describe('TaskPrioritySchema', () => {
    it('should accept all TASK_PRIORITY values', () => {
      for (const priority of Object.values(TASK_PRIORITY)) {
        expect(TaskPrioritySchema.safeParse(priority).success).toBe(true);
      }
    });
  });

  describe('TaskRecurrenceSchema', () => {
    it('should accept all TASK_RECURRENCE values', () => {
      for (const pattern of Object.values(TASK_RECURRENCE)) {
        expect(TaskRecurrenceSchema.safeParse(pattern).success).toBe(true);
      }
    });
  });

  describe('ScheduleStatusSchema', () => {
    it('should accept all SCHEDULE_STATUS values', () => {
      for (const status of Object.values(SCHEDULE_STATUS)) {
        expect(ScheduleStatusSchema.safeParse(status).success).toBe(true);
      }
    });
  });

  describe('DiscountTypeSchema', () => {
    it('should accept all DISCOUNT_TYPE values', () => {
      for (const type of Object.values(DISCOUNT_TYPE)) {
        expect(DiscountTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('should have 3 types: none, percentage, fixed', () => {
      expect(Object.values(DISCOUNT_TYPE)).toHaveLength(3);
    });

    it('should reject invalid type', () => {
      expect(DiscountTypeSchema.safeParse('coupon').success).toBe(false);
    });
  });

  describe('RefundMethodSchema', () => {
    it('should accept all REFUND_METHOD values', () => {
      for (const method of Object.values(REFUND_METHOD)) {
        expect(RefundMethodSchema.safeParse(method).success).toBe(true);
      }
    });

    it('should reject invalid method', () => {
      expect(RefundMethodSchema.safeParse('bitcoin').success).toBe(false);
    });
  });

  describe('CurrencyPositionSchema', () => {
    it('should accept all CURRENCY_POSITION values', () => {
      for (const pos of Object.values(CURRENCY_POSITION)) {
        expect(CurrencyPositionSchema.safeParse(pos).success).toBe(true);
      }
    });
  });
});

// ─── Table Schema Tests ──────────────────────────────────────────

describe('Table Schemas', () => {
  describe('OrderSchema', () => {
    const validOrder = {
      id: uuid1,
      tenant_id: uuid1,
      table_id: uuid2,
      assigned_waiter_id: null,
      order_number: 'ORD2601010001',
      status: 'new',
      source: 'customer',
      order_type: 'dine_in',
      customer_name: null,
      customer_phone: null,
      subtotal: 100.0,
      tax: 18.0,
      total: 118.0,
      customer_notes: null,
      internal_notes: null,
      created_at: now,
      updated_at: now,
      preparing_at: null,
      ready_at: null,
      served_at: null,
      closed_at: null,
      payment_method: null,
      paid_at: null,
      discount_type: 'none',
      discount_value: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_applied_by: null,
      delivery_address: null,
      delivery_fee: 0,
      delivery_notes: null,
      estimated_delivery_time: null,
      delivered_at: null,
      delivery_person_id: null,
      delivery_access_token: null,
    };

    it('should validate a complete order', () => {
      expect(OrderSchema.safeParse(validOrder).success).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(OrderSchema.safeParse({ ...validOrder, status: 'paid' }).success).toBe(false);
    });

    it('should accept delivery order', () => {
      const deliveryOrder = {
        ...validOrder,
        table_id: null,
        order_type: 'delivery',
        customer_name: 'John',
        customer_phone: '+1234567890',
        delivery_address: '123 Main St',
        delivery_fee: 5.0,
      };
      expect(OrderSchema.safeParse(deliveryOrder).success).toBe(true);
    });

    it('should allow nullable table_id for takeout', () => {
      expect(
        OrderSchema.safeParse({ ...validOrder, table_id: null, order_type: 'takeout' }).success,
      ).toBe(true);
    });
  });

  describe('OrderItemSchema', () => {
    const validItem = {
      id: uuid1,
      tenant_id: uuid1,
      order_id: uuid2,
      menu_item_id: uuid1,
      category_id: null,
      item_name: 'Pizza',
      item_price: 15.99,
      quantity: 2,
      notes: null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };

    it('should validate a valid order item', () => {
      expect(OrderItemSchema.safeParse(validItem).success).toBe(true);
    });

    it('should reject zero quantity', () => {
      expect(OrderItemSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false);
    });

    it('should reject negative quantity', () => {
      expect(OrderItemSchema.safeParse({ ...validItem, quantity: -1 }).success).toBe(false);
    });

    it('should accept cancelled status', () => {
      expect(OrderItemSchema.safeParse({ ...validItem, status: 'cancelled' }).success).toBe(true);
    });
  });

  describe('TableSchema', () => {
    const validTable = {
      id: uuid1,
      tenant_id: uuid1,
      table_number: '1',
      qr_code: 'TABLE_001',
      capacity: 4,
      status: 'free',
      location: null,
      current_session_id: null,
      occupied_at: null,
      is_active: true,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate a complete table', () => {
      expect(TableSchema.safeParse(validTable).success).toBe(true);
    });

    it('should accept table_number as string (not number)', () => {
      expect(TableSchema.safeParse(validTable).success).toBe(true);
      // table_number is VARCHAR in DB, must be string
      expect(TableSchema.safeParse({ ...validTable, table_number: 1 }).success).toBe(false);
    });

    it('should reject invalid status', () => {
      expect(TableStatusSchema.safeParse('dirty').success).toBe(false);
    });

    it('should accept all valid table statuses', () => {
      for (const status of ['free', 'occupied', 'reserved', 'closed']) {
        expect(TableStatusSchema.safeParse(status).success).toBe(true);
      }
    });
  });

  describe('MenuItemSchema', () => {
    const validMenuItem = {
      id: uuid1,
      tenant_id: uuid1,
      category_id: uuid2,
      name: 'Pizza Margherita',
      description: null,
      price: 15.99,
      image_url: null,
      preparation_time: null,
      is_popular: false,
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      is_spicy: false,
      allergens: [],
      is_available: true,
      is_takeoutable: true,
      is_deliverable: true,
      is_daily_special: false,
      display_order: 0,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid menu item', () => {
      expect(MenuItemSchema.safeParse(validMenuItem).success).toBe(true);
    });

    it('should reject negative price', () => {
      expect(MenuItemSchema.safeParse({ ...validMenuItem, price: -10 }).success).toBe(false);
    });

    it('should allow zero price for free/promotional items', () => {
      expect(MenuItemSchema.safeParse({ ...validMenuItem, price: 0 }).success).toBe(true);
    });

    it('should allow nullable category_id', () => {
      expect(MenuItemSchema.safeParse({ ...validMenuItem, category_id: null }).success).toBe(true);
    });

    it('should allow nullable allergens array', () => {
      expect(MenuItemSchema.safeParse({ ...validMenuItem, allergens: null }).success).toBe(true);
    });
  });

  describe('StaffSchema', () => {
    const validStaff = {
      id: uuid1,
      tenant_id: uuid1,
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'waiter',
      phone: null,
      is_active: true,
      created_at: now,
      updated_at: now,
      last_login_at: null,
      auth_user_id: null,
      preferred_language: 'en',
    };

    it('should validate valid staff', () => {
      expect(StaffSchema.safeParse(validStaff).success).toBe(true);
    });

    it('should accept owner role', () => {
      expect(StaffSchema.safeParse({ ...validStaff, role: 'owner' }).success).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(StaffSchema.safeParse({ ...validStaff, email: 'not-an-email' }).success).toBe(false);
    });

    it('should reject invalid role', () => {
      expect(StaffSchema.safeParse({ ...validStaff, role: 'manager' }).success).toBe(false);
    });
  });

  describe('WaiterCallSchema', () => {
    const validCall = {
      id: uuid1,
      tenant_id: uuid1,
      table_id: uuid2,
      reason: 'Need help',
      call_type: 'assistance',
      priority: 'normal',
      status: 'pending',
      responded_by: null,
      created_at: now,
      acknowledged_at: null,
      resolved_at: null,
      notes: null,
    };

    it('should validate valid waiter call', () => {
      expect(WaiterCallSchema.safeParse(validCall).success).toBe(true);
    });

    it('should accept acknowledged status', () => {
      expect(WaiterCallSchema.safeParse({ ...validCall, status: 'acknowledged' }).success).toBe(
        true,
      );
    });

    it('should reject "completed" status', () => {
      expect(WaiterCallSchema.safeParse({ ...validCall, status: 'completed' }).success).toBe(false);
    });
  });

  describe('CustomerFeedbackSchema', () => {
    const validFeedback = {
      id: uuid1,
      tenant_id: uuid1,
      table_id: uuid2,
      order_id: null,
      feedback_type: 'complaint',
      message: 'The food was cold',
      status: 'pending',
      responded_by: null,
      response: null,
      created_at: now,
      acknowledged_at: null,
      resolved_at: null,
    };

    it('should validate valid feedback', () => {
      expect(CustomerFeedbackSchema.safeParse(validFeedback).success).toBe(true);
    });

    it('should accept all specific feedback types', () => {
      for (const type of Object.values(FEEDBACK_TYPE)) {
        expect(
          CustomerFeedbackSchema.safeParse({ ...validFeedback, feedback_type: type }).success,
        ).toBe(true);
      }
    });

    it('should reject old granular feedback types', () => {
      expect(
        CustomerFeedbackSchema.safeParse({ ...validFeedback, feedback_type: 'complaint_food' })
          .success,
      ).toBe(false);
    });
  });

  describe('OrderPaymentSchema', () => {
    const validPayment = {
      id: uuid1,
      tenant_id: uuid1,
      order_id: uuid2,
      received_by: uuid1,
      payment_type: 'full',
      amount: 50.0,
      tip_amount: 5.0,
      payment_method: 'card',
      order_item_ids: null,
      notes: null,
      created_at: now,
    };

    it('should validate valid payment', () => {
      expect(OrderPaymentSchema.safeParse(validPayment).success).toBe(true);
    });

    it('should reject zero amount', () => {
      expect(OrderPaymentSchema.safeParse({ ...validPayment, amount: 0 }).success).toBe(false);
    });

    it('should reject negative amount', () => {
      expect(OrderPaymentSchema.safeParse({ ...validPayment, amount: -10 }).success).toBe(false);
    });
  });

  describe('TableTransferSchema', () => {
    const validTransfer = {
      id: uuid1,
      tenant_id: uuid1,
      order_id: uuid2,
      from_table_id: uuid1,
      to_table_id: uuid2,
      transferred_by: uuid1,
      reason: null,
      created_at: now,
    };

    it('should validate valid transfer', () => {
      expect(TableTransferSchema.safeParse(validTransfer).success).toBe(true);
    });
  });

  describe('StaffScheduleSchema', () => {
    const validSchedule = {
      id: uuid1,
      tenant_id: uuid1,
      staff_id: uuid2,
      date: '2026-03-22',
      planned_start: '09:00',
      planned_end: '17:00',
      actual_start: null,
      actual_end: null,
      status: 'scheduled',
      notes: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid schedule', () => {
      expect(StaffScheduleSchema.safeParse(validSchedule).success).toBe(true);
    });

    it('should accept all schedule statuses', () => {
      for (const status of Object.values(SCHEDULE_STATUS)) {
        expect(StaffScheduleSchema.safeParse({ ...validSchedule, status }).success).toBe(true);
      }
    });
  });

  describe('StockItemSchema', () => {
    const validStock = {
      id: uuid1,
      tenant_id: uuid1,
      name: 'Flour',
      description: null,
      category: 'ingredients',
      quantity: 50,
      unit: 'kg',
      cost_price: 2.5,
      minimum_stock_level: 10,
      supplier_name: null,
      notes: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid stock item', () => {
      expect(StockItemSchema.safeParse(validStock).success).toBe(true);
    });
  });

  describe('StockMovementSchema', () => {
    const validMovement = {
      id: uuid1,
      tenant_id: uuid1,
      stock_item_id: uuid2,
      movement_type: 'in',
      quantity_change: 25,
      quantity_after: 75,
      reason: null,
      performed_by: null,
      created_at: now,
    };

    it('should validate valid stock movement', () => {
      expect(StockMovementSchema.safeParse(validMovement).success).toBe(true);
    });
  });

  describe('ExpenseSchema', () => {
    const validExpense = {
      id: uuid1,
      tenant_id: uuid1,
      category_id: uuid2,
      amount: 500,
      description: 'Monthly rent',
      payment_method: 'bank_transfer',
      expense_date: '2026-03-01',
      receipt_url: null,
      created_by: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid expense', () => {
      expect(ExpenseSchema.safeParse(validExpense).success).toBe(true);
    });

    it('should reject zero amount', () => {
      expect(ExpenseSchema.safeParse({ ...validExpense, amount: 0 }).success).toBe(false);
    });
  });

  describe('WasteLogSchema', () => {
    const validWaste = {
      id: uuid1,
      tenant_id: uuid1,
      item_name: 'Tomatoes',
      category: 'produce',
      quantity: 5,
      unit: 'kg',
      cost_per_unit: 3.0,
      total_cost: 15.0,
      reason: 'expired',
      stock_item_id: null,
      notes: null,
      logged_by: null,
      waste_date: '2026-03-22',
      created_at: now,
    };

    it('should validate valid waste log', () => {
      expect(WasteLogSchema.safeParse(validWaste).success).toBe(true);
    });

    it('should accept all waste reasons', () => {
      for (const reason of Object.values(WASTE_REASON)) {
        expect(WasteLogSchema.safeParse({ ...validWaste, reason }).success).toBe(true);
      }
    });

    it('should reject zero quantity', () => {
      expect(WasteLogSchema.safeParse({ ...validWaste, quantity: 0 }).success).toBe(false);
    });
  });

  describe('TaskSchema', () => {
    const validTask = {
      id: uuid1,
      tenant_id: uuid1,
      title: 'Clean kitchen',
      description: null,
      category_id: null,
      priority: 'normal',
      status: 'pending',
      assigned_to: null,
      created_by: null,
      due_date: null,
      due_time: null,
      completed_at: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_days: null,
      parent_task_id: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid task', () => {
      expect(TaskSchema.safeParse(validTask).success).toBe(true);
    });

    it('should accept recurring task', () => {
      const recurring = {
        ...validTask,
        is_recurring: true,
        recurrence_pattern: 'weekly',
        recurrence_days: [1, 3, 5],
      };
      expect(TaskSchema.safeParse(recurring).success).toBe(true);
    });

    it('should accept all task statuses', () => {
      for (const status of Object.values(TASK_STATUS)) {
        expect(TaskSchema.safeParse({ ...validTask, status }).success).toBe(true);
      }
    });

    it('should accept all task priorities', () => {
      for (const priority of Object.values(TASK_PRIORITY)) {
        expect(TaskSchema.safeParse({ ...validTask, priority }).success).toBe(true);
      }
    });
  });

  describe('CafeSettingsSchema', () => {
    const validSettings = {
      id: '00000000-0000-0000-0000-000000000001',
      tenant_id: uuid1,
      restaurant_name: 'Test Cafe',
      tax_enabled: true,
      tax_percentage: 18,
      tax_label: 'VAT',
      prices_include_tax: false,
      show_tax_separately: true,
      currency_symbol: '₼',
      currency_code: 'AZN',
      currency_position: 'after',
      currency_decimal_places: 2,
      minimum_order_amount: 0,
      allow_item_notes: true,
      allow_order_notes: true,
      cafe_logo_url: null,
      hero_image_url: null,
      brand_primary_color: '#367B8B',
      brand_secondary_color: '#1E40AF',
      welcome_heading: null,
      welcome_message: null,
      qr_ordering_enabled: true,
      tips_enabled: false,
      waste_tracking_enabled: false,
      delivery_enabled: false,
      delivery_fee_default: 0,
      minimum_delivery_amount: 0,
      delivery_zone_info: null,
      restaurant_address: null,
      contact_phone: null,
      contact_website: null,
      social_instagram: null,
      social_whatsapp: null,
      social_tiktok: null,
      social_telegram: null,
      social_line: null,
      location_maps_url: null,
      default_language: 'en',
      created_at: now,
      updated_at: now,
    };

    it('should validate valid cafe settings', () => {
      expect(CafeSettingsSchema.safeParse(validSettings).success).toBe(true);
    });

    it('should accept both currency positions', () => {
      expect(
        CafeSettingsSchema.safeParse({ ...validSettings, currency_position: 'before' }).success,
      ).toBe(true);
      expect(
        CafeSettingsSchema.safeParse({ ...validSettings, currency_position: 'after' }).success,
      ).toBe(true);
    });

    it('should reject invalid currency position', () => {
      expect(CurrencyPositionSchema.safeParse('left').success).toBe(false);
    });
  });

  describe('RefundSchema', () => {
    const validRefund = {
      id: uuid1,
      tenant_id: uuid1,
      order_id: uuid2,
      processed_by: uuid1,
      amount: 25.0,
      reason: 'Customer complaint',
      refund_method: 'cash',
      order_item_ids: null,
      notes: null,
      created_at: now,
    };

    it('should validate valid refund', () => {
      expect(RefundSchema.safeParse(validRefund).success).toBe(true);
    });

    it('should reject zero amount', () => {
      expect(RefundSchema.safeParse({ ...validRefund, amount: 0 }).success).toBe(false);
    });

    it('should reject negative amount', () => {
      expect(RefundSchema.safeParse({ ...validRefund, amount: -10 }).success).toBe(false);
    });

    it('should reject empty reason', () => {
      expect(RefundSchema.safeParse({ ...validRefund, reason: '' }).success).toBe(false);
    });

    it('should accept all refund methods', () => {
      for (const method of ['cash', 'card', 'digital']) {
        expect(RefundSchema.safeParse({ ...validRefund, refund_method: method }).success).toBe(
          true,
        );
      }
    });

    it('should reject invalid refund method', () => {
      expect(RefundSchema.safeParse({ ...validRefund, refund_method: 'bitcoin' }).success).toBe(
        false,
      );
    });
  });
});
