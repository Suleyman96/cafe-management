import { describe, expect, it } from 'vitest';
import {
  MenuItemSchema,
  OrderSchema,
  OrderSourceSchema,
  OrderStatusSchema,
  TableSchema,
  TableStatusSchema,
} from '../schemas';

const uuid1 = '123e4567-e89b-12d3-a456-426614174000';
const uuid2 = '123e4567-e89b-12d3-a456-426614174001';
const now = new Date().toISOString();

describe('Database Schemas', () => {
  describe('OrderSchema', () => {
    const validOrder = {
      id: uuid1,
      status: 'new',
      source: 'customer',
      table_id: uuid2,
      customer_name: null,
      customer_phone: null,
      staff_id: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid order data', () => {
      const result = OrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = OrderSchema.safeParse({ ...validOrder, status: 'invalid_status' });
      expect(result.success).toBe(false);
    });

    it('should accept all valid sources', () => {
      for (const source of ['customer', 'waiter', 'phone']) {
        const result = OrderSourceSchema.safeParse(source);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid source', () => {
      const result = OrderSourceSchema.safeParse('mobile');
      expect(result.success).toBe(false);
    });

    it('should allow nullable table_id', () => {
      const result = OrderSchema.safeParse({ ...validOrder, table_id: null });
      expect(result.success).toBe(true);
    });
  });

  describe('OrderStatusSchema', () => {
    it('should accept all valid statuses', () => {
      for (const status of ['new', 'preparing', 'ready', 'served', 'paid', 'cancelled']) {
        const result = OrderStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = OrderStatusSchema.safeParse('completed');
      expect(result.success).toBe(false);
    });
  });

  describe('TableSchema', () => {
    const validTable = {
      id: uuid1,
      table_number: 1,
      status: 'free',
      capacity: 4,
      qr_code: 'TABLE_001',
      location: null,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid table data', () => {
      const result = TableSchema.safeParse(validTable);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = TableStatusSchema.safeParse('dirty');
      expect(result.success).toBe(false);
    });

    it('should accept all valid table statuses', () => {
      for (const status of ['free', 'occupied', 'reserved', 'closed']) {
        const result = TableStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('MenuItemSchema', () => {
    const validMenuItem = {
      id: uuid1,
      name: 'Pizza Margherita',
      description: null,
      price: 15.99,
      category_id: uuid2,
      image_url: null,
      is_available: true,
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      is_spicy: false,
      is_popular: false,
      is_daily_special: false,
      allergens: [],
      display_order: 0,
      created_at: now,
      updated_at: now,
    };

    it('should validate valid menu item', () => {
      const result = MenuItemSchema.safeParse(validMenuItem);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const result = MenuItemSchema.safeParse({ ...validMenuItem, price: -10 });
      expect(result.success).toBe(false);
    });

    it('should reject zero price', () => {
      const result = MenuItemSchema.safeParse({ ...validMenuItem, price: 0 });
      expect(result.success).toBe(false);
    });
  });
});
