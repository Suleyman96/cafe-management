-- Sample data for development and testing

-- Create admin user (password: admin123)
-- Note: In production, use auth.users properly
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@cafe.com')
ON CONFLICT (id) DO NOTHING;

-- Insert staff members
INSERT INTO staff (id, email, full_name, role, auth_user_id, is_active) VALUES
('10000000-0000-0000-0000-000000000001', 'admin@cafe.com', 'Admin User', 'admin', '00000000-0000-0000-0000-000000000001', true),
('10000000-0000-0000-0000-000000000002', 'waiter1@cafe.com', 'John Doe', 'waiter', null, true),
('10000000-0000-0000-0000-000000000003', 'waiter2@cafe.com', 'Jane Smith', 'waiter', null, true),
('10000000-0000-0000-0000-000000000004', 'kitchen@cafe.com', 'Chef Mike', 'kitchen', null, true)
ON CONFLICT (id) DO NOTHING;

-- Insert tables
INSERT INTO tables (id, table_number, qr_code, capacity, location, status, is_active) VALUES
('20000000-0000-0000-0000-000000000001', 'T01', 'qr_token_table_01', 4, 'Window', 'free', true),
('20000000-0000-0000-0000-000000000002', 'T02', 'qr_token_table_02', 4, 'Window', 'free', true),
('20000000-0000-0000-0000-000000000003', 'T03', 'qr_token_table_03', 2, 'Corner', 'free', true),
('20000000-0000-0000-0000-000000000004', 'T04', 'qr_token_table_04', 6, 'Center', 'free', true),
('20000000-0000-0000-0000-000000000005', 'T05', 'qr_token_table_05', 4, 'Patio', 'free', true),
('20000000-0000-0000-0000-000000000006', 'T06', 'qr_token_table_06', 4, 'Patio', 'free', true),
('20000000-0000-0000-0000-000000000007', 'T07', 'qr_token_table_07', 2, 'Bar', 'free', true),
('20000000-0000-0000-0000-000000000008', 'T08', 'qr_token_table_08', 8, 'Private', 'free', true)
ON CONFLICT (id) DO NOTHING;

-- Insert categories
INSERT INTO categories (id, name_en, name_az, icon, display_order, is_active) VALUES
('30000000-0000-0000-0000-000000000001', 'Hot Drinks', 'İsti İçkilər', '☕', 1, true),
('30000000-0000-0000-0000-000000000002', 'Cold Drinks', 'Soyuq İçkilər', '🥤', 2, true),
('30000000-0000-0000-0000-000000000003', 'Breakfast', 'Səhər yeməyi', '🍳', 3, true),
('30000000-0000-0000-0000-000000000004', 'Pastries', 'Xəmir məmulatları', '🥐', 4, true),
('30000000-0000-0000-0000-000000000005', 'Desserts', 'Şirniyyatlar', '🍰', 5, true)
ON CONFLICT (id) DO NOTHING;

-- Insert menu items
INSERT INTO menu_items (id, category_id, name_en, name_az, description_en, price, preparation_time, is_popular, is_vegetarian, is_available) VALUES
-- Hot Drinks
('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Espresso', 'Espresso', 'Classic Italian espresso', 3.50, 3, true, true, true),
('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Cappuccino', 'Kapuçino', 'Espresso with steamed milk and foam', 5.50, 5, true, true, true),
('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Latte', 'Latte', 'Espresso with steamed milk', 6.00, 5, false, true, true),
('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Turkish Coffee', 'Türk qəhvəsi', 'Traditional Turkish coffee', 4.00, 7, true, true, true),

-- Cold Drinks
('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'Iced Latte', 'Buzlu Latte', 'Cold latte with ice', 6.50, 4, true, true, true),
('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', 'Fresh Orange Juice', 'Təzə Portağal Şirəsi', 'Freshly squeezed orange juice', 5.00, 5, false, true, true),
('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000002', 'Lemonade', 'Limonad', 'Homemade lemonade', 4.50, 3, false, true, true),

-- Breakfast
('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 'Omelette', 'Omlet', 'Three-egg omelette with vegetables', 8.50, 10, true, true, true),
('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', 'Pancakes', 'Pankek', 'Stack of fluffy pancakes with syrup', 9.00, 12, true, true, true),
('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000003', 'Avocado Toast', 'Avokado Tost', 'Whole grain toast with smashed avocado', 10.00, 8, true, true, true),

-- Pastries
('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000004', 'Croissant', 'Kruasan', 'Buttery French croissant', 3.50, 5, true, true, true),
('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000004', 'Chocolate Croissant', 'Şokoladlı Kruasan', 'Croissant filled with chocolate', 4.00, 5, false, true, true),
('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000004', 'Muffin', 'Muffin', 'Blueberry muffin', 3.00, 2, false, true, true),

-- Desserts
('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000005', 'Cheesecake', 'Çizkeyk', 'New York style cheesecake', 7.50, 5, true, true, true),
('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000005', 'Tiramisu', 'Tiramisu', 'Classic Italian tiramisu', 8.00, 5, true, true, true),
('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000005', 'Baklava', 'Pakhlava', 'Traditional Azerbaijani baklava', 6.00, 3, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Add allergens to some items
UPDATE menu_items SET allergens = ARRAY['milk', 'lactose'] WHERE id IN (
  '40000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000014',
  '40000000-0000-0000-0000-000000000015'
);

UPDATE menu_items SET allergens = ARRAY['gluten', 'eggs'] WHERE id IN (
  '40000000-0000-0000-0000-000000000011',
  '40000000-0000-0000-0000-000000000012',
  '40000000-0000-0000-0000-000000000013'
);

UPDATE menu_items SET allergens = ARRAY['eggs'] WHERE id IN (
  '40000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000009'
);

UPDATE menu_items SET allergens = ARRAY['nuts'] WHERE id = '40000000-0000-0000-0000-000000000016';


