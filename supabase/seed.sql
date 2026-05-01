-- Sample data for development and testing
-- NOTE: Admin user (admin@test.com / test1234) is created via Supabase Admin API
-- Run: npm run db:seed-user (or see scripts/create-admin-user.sh)

-- Insert default tenant (required before any other data)
INSERT INTO tenants (id, name, slug, plan) VALUES
('00000000-0000-0000-0000-000000000001', 'Default Restaurant', 'default', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Insert staff members (auth_user_id will be updated after user is created)
INSERT INTO staff (id, tenant_id, email, full_name, role, auth_user_id, is_active) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@test.com', 'Admin User', 'admin', null, true),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'waiter1@cafe.com', 'Tanaka Yuki', 'waiter', null, true),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'waiter2@cafe.com', 'Sato Hana', 'waiter', null, true),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'kitchen@cafe.com', 'Chef Kenji', 'kitchen', null, true)
ON CONFLICT (id) DO NOTHING;

-- Insert tables
INSERT INTO tables (id, tenant_id, table_number, qr_code, capacity, location, status, is_active) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'T01', 'qr_token_table_01', 4, 'Window', 'free', true),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'T02', 'qr_token_table_02', 4, 'Window', 'free', true),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'T03', 'qr_token_table_03', 2, 'Corner', 'free', true),
('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'T04', 'qr_token_table_04', 6, 'Center', 'free', true),
('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'T05', 'qr_token_table_05', 4, 'Patio', 'free', true),
('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'T06', 'qr_token_table_06', 4, 'Patio', 'free', true),
('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'T07', 'qr_token_table_07', 2, 'Bar', 'free', true),
('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'T08', 'qr_token_table_08', 8, 'Private', 'free', true)
ON CONFLICT (id) DO NOTHING;

-- Insert categories
INSERT INTO categories (id, tenant_id, name, icon, display_order, is_active) VALUES
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Hot Drinks', '☕', 1, true),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Cold Drinks', '🥤', 2, true),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Rice & Noodles', '🍜', 3, true),
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Sushi & Sashimi', '🍣', 4, true),
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Desserts', '🍡', 5, true)
ON CONFLICT (id) DO NOTHING;

-- Insert menu items
INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, preparation_time, is_popular, is_vegetarian, is_available) VALUES
-- Hot Drinks
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Matcha Latte', 'Traditional Japanese matcha with steamed milk', 550, 3, true, true, true),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Hojicha', 'Roasted Japanese green tea', 450, 3, true, true, true),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Sencha', 'Premium Japanese green tea', 400, 3, false, true, true),
('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Cappuccino', 'Espresso with steamed milk and foam', 500, 5, true, true, true),

-- Cold Drinks
('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Iced Matcha', 'Cold matcha with ice and milk', 600, 4, true, true, true),
('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Ramune', 'Japanese marble soda', 350, 1, false, true, true),
('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Yuzu Lemonade', 'Refreshing Japanese citrus lemonade', 500, 3, false, true, true),

-- Rice & Noodles
('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Tonkotsu Ramen', 'Rich pork bone broth ramen with chashu', 1200, 10, true, false, true),
('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Katsu Curry Rice', 'Crispy pork cutlet with Japanese curry', 1100, 12, true, false, true),
('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Tempura Udon', 'Thick wheat noodles with shrimp tempura', 1000, 8, true, false, true),

-- Sushi & Sashimi
('40000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Salmon Nigiri Set', 'Fresh salmon nigiri sushi (6 pieces)', 1400, 5, true, false, true),
('40000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'California Roll', 'Crab, avocado, and cucumber roll (8 pieces)', 900, 5, false, false, true),
('40000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Edamame', 'Steamed salted soybeans', 400, 2, false, true, true),

-- Desserts
('40000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Matcha Cheesecake', 'Creamy matcha-flavored cheesecake', 750, 5, true, true, true),
('40000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Mochi Ice Cream', 'Assorted mochi ice cream (3 pieces)', 600, 2, true, true, true),
('40000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Dorayaki', 'Traditional Japanese red bean pancake', 450, 3, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Add allergens to some items
UPDATE menu_items SET allergens = ARRAY['milk', 'lactose'] WHERE id IN (
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000004',
  '40000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000014',
  '40000000-0000-0000-0000-000000000015'
);

UPDATE menu_items SET allergens = ARRAY['gluten', 'eggs'] WHERE id IN (
  '40000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000010'
);

UPDATE menu_items SET allergens = ARRAY['shellfish'] WHERE id IN (
  '40000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000012'
);

UPDATE menu_items SET allergens = ARRAY['soy'] WHERE id = '40000000-0000-0000-0000-000000000013';

UPDATE menu_items SET allergens = ARRAY['gluten'] WHERE id = '40000000-0000-0000-0000-000000000016';

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant 2 (cross-tenant isolation fixture)
-- ─────────────────────────────────────────────────────────────────────────────
-- Used by apps/mobile/maestro/tenant-switch.yaml to prove that signing out of
-- tenant 1 and signing into tenant 2 wipes the React Query cache. Distinctive
-- rows (table_number='T2-ONLY', restaurant_name='Test Tenant Two') would be
-- visible if cache leaked across the tenant transition. Auth user for
-- admin2@test.com is provisioned by scripts/create-admin-user.sh — this file
-- only seeds the staff/tenant rows.

INSERT INTO tenants (id, name, slug, plan) VALUES
('00000000-0000-0000-0000-000000000002', 'Test Tenant Two', 'tenant-two', 'pro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, tenant_id, email, full_name, role, auth_user_id, is_active) VALUES
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'admin2@test.com', 'Admin Two', 'admin', null, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cafe_settings (tenant_id, restaurant_name) VALUES
('00000000-0000-0000-0000-000000000002', 'Test Tenant Two')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tables (id, tenant_id, table_number, qr_code, capacity, location, status, is_active) VALUES
('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'T2-ONLY', 'qr_token_tenant2_only', 4, 'Tenant-2-Only', 'free', true)
ON CONFLICT (id) DO NOTHING;
