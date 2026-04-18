-- Migration: Add delivery_customers table
-- Date: 2026-04-04

-- ========================================
-- 1. Create delivery_customers table
-- ========================================

CREATE TABLE public.delivery_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  order_count INT NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_customers_phone ON public.delivery_customers(phone);
CREATE INDEX idx_delivery_customers_name ON public.delivery_customers(name);

COMMENT ON TABLE public.delivery_customers IS 'Saved delivery customer profiles for quick order creation';
