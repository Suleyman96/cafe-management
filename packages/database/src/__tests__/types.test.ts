import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { OrderSchema, TableSchema, MenuItemSchema } from '../schemas';

describe('Database Schemas', () => {
  describe('OrderSchema', () => {
    it('should validate valid order data', () => {
      const validOrder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'new',
        source: 'customer',
        table_id: '123e4567-e89b-12d3-a456-426614174001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = OrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidOrder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'invalid_status',
        source: 'customer',
      };

      const result = OrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });
  });

  describe('TableSchema', () => {
    it('should validate valid table data', () => {
      const validTable = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        table_number: 1,
        status: 'free',
        capacity: 4,
        qr_code: 'TABLE_001',
      };

      const result = TableSchema.safeParse(validTable);
      expect(result.success).toBe(true);
    });
  });

  describe('MenuItemSchema', () => {
    it('should validate valid menu item', () => {
      const validMenuItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name_en: 'Pizza Margherita',
        price: 15.99,
        category_id: '123e4567-e89b-12d3-a456-426614174001',
        is_available: true,
      };

      const result = MenuItemSchema.safeParse(validMenuItem);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const invalidMenuItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name_en: 'Pizza',
        price: -10,
      };

      const result = MenuItemSchema.safeParse(invalidMenuItem);
      expect(result.success).toBe(false);
    });
  });
});