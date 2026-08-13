-- ============================================================================
-- RestoFlow: Realistic Seed Data Script
-- File: supabase/seed.sql
-- Description: Seed script for Roles, Users, Categories, Products, Customers,
--              Tables, Suppliers, Purchases, Orders, Order Items, & Payments.
-- ============================================================================

BEGIN;

-- 1. SEED ROLES
INSERT INTO roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000001', 'ADMIN', 'System Administrator with full permissions'),
('00000000-0000-0000-0000-000000000002', 'MANAGER', 'Restaurant Manager with operational and financial access'),
('00000000-0000-0000-0000-000000000003', 'CASHIER', 'POS Cashier focused on order creation and payment entry'),
('00000000-0000-0000-0000-000000000004', 'STAFF', 'Floor Staff for order status updates')
ON CONFLICT (name) DO NOTHING;

-- 1.5. SEED AUTH USERS (Required for public.users foreign key)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES 
('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@restoflow.sa', crypt('demo123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'manager@restoflow.sa', crypt('demo123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'cashier@restoflow.sa', crypt('demo123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'staff@restoflow.sa', crypt('demo123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED DEMO USERS (Fixed UUIDs linked to roles)
INSERT INTO users (id, role_id, name, email, phone, is_active) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Mohammed Hamza', 'admin@restoflow.sa', '+966500000001', true),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'Ahmed Khalid', 'manager@restoflow.sa', '+966500000002', true),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000003', 'Amro Ali', 'cashier@restoflow.sa', '+966500000003', true),
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000004', 'Ahmed Youssef', 'staff@restoflow.sa', '+966500000004', true)
ON CONFLICT (email) DO NOTHING;

-- 3. SEED CATEGORIES
INSERT INTO categories (id, name, description, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'Burgers', 'Gourmet beef and chicken burgers', true),
('a0000000-0000-0000-0000-000000000002', 'Pizza', 'Artisanal stone-baked pizzas', true),
('a0000000-0000-0000-0000-000000000003', 'Drinks', 'Refreshing hot and cold beverages', true),
('a0000000-0000-0000-0000-000000000004', 'Desserts', 'Decadent sweets and pastries', true),
('a0000000-0000-0000-0000-000000000005', 'Meals', 'Chef signature main platters', true)
ON CONFLICT DO NOTHING;

-- 4. SEED 15+ REALISTIC PRODUCTS
INSERT INTO products (id, category_id, name, description, sku, price, cost, stock_quantity, minimum_stock, is_active) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Truffle Smash Burger', 'Double Angus patty, truffle mayo, Swiss cheese', 'BRG-001', 45.00, 18.00, 35, 10, true),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Classic Cheese Burger', 'Angus beef, cheddar, special sauce, brioche', 'BRG-002', 38.00, 14.00, 42, 10, true),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Crispy Spicy Chicken', 'Crispy fried chicken thigh, jalapeño slaw', 'BRG-003', 36.00, 12.50, 4, 10, true), -- Low stock alert
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Smoky BBQ Bacon Burger', 'Angus patty, beef bacon, smoky BBQ sauce', 'BRG-004', 48.00, 19.50, 20, 8, true),

('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Neapolitan Margherita', 'San Marzano tomato sauce, fresh mozzarella, basil', 'PZA-001', 52.00, 16.00, 25, 5, true),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'Pepperoni Feast', 'Double beef pepperoni, mozzarella, oregano', 'PZA-002', 58.00, 20.00, 18, 5, true),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Truffle Mushroom Pizza', 'White cream base, wild mushrooms, truffle oil', 'PZA-003', 68.00, 26.00, 12, 5, true),

('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Fresh Orange Juice', '100% cold pressed fresh orange juice', 'DRK-001', 18.00, 5.00, 60, 15, true),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'Spanish Iced Latte', 'Espresso, condensed milk, chilled milk', 'DRK-002', 22.00, 6.50, 50, 15, true),
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'Classic Mojito', 'Fresh mint, lime juice, sparkling water', 'DRK-003', 20.00, 4.50, 0, 10, true), -- Out of stock

('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004', 'Molten Chocolate Cake', 'Warm chocolate fondant, vanilla gelato', 'DES-001', 32.00, 10.00, 15, 5, true),
('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000004', 'San Sebastian Cheesecake', 'Burnt Basque cheesecake, Belgian chocolate drizzle', 'DES-002', 35.00, 11.50, 22, 5, true),

('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'Ribeye Steak Platter', '300g Prime Ribeye, truffle fries, herb butter', 'MEL-001', 120.00, 48.00, 10, 4, true),
('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005', 'Grilled Salmon Bowl', 'Atlantic salmon, quinoa, avocado, sesame dressing', 'MEL-002', 85.00, 32.00, 14, 4, true),
('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005', 'Slow-Cooked Lamb Shank', 'Braised lamb shank, saffron risotto', 'MEL-003', 95.00, 38.00, 8, 3, true)
ON CONFLICT (sku) DO NOTHING;

-- 5. SEED 8 DEMO CUSTOMERS
INSERT INTO customers (id, name, phone, email, address, customer_type) VALUES
('c0000000-0000-0000-0000-000000000001', 'Walk-in Guest', NULL, NULL, NULL, 'GUEST'),
('c0000000-0000-0000-0000-000000000002', 'Prince Khalid Al-Saud', '+966551112233', 'khalid@vip.sa', 'Riyadh Boulevard', 'VIP'),
('c0000000-0000-0000-0000-000000000003', 'Reem Al-Dossary', '+966552223344', 'reem.dossary@gmail.com', 'Olaya District', 'REGULAR'),
('c0000000-0000-0000-0000-000000000004', 'Abdullah Al-Ghamdi', '+966553334455', 'a.ghamdi@tech.sa', 'King Fahd Road', 'REGULAR'),
('c0000000-0000-0000-0000-000000000005', 'Noura Al-Hassan', '+966554445566', 'noura@design.sa', 'Al-Nakheel', 'VIP'),
('c0000000-0000-0000-0000-000000000006', 'Faisal Al-Mutairi', '+966555556677', 'faisal.m@gmail.com', 'Al-Malqa', 'REGULAR'),
('c0000000-0000-0000-0000-000000000007', 'Lina Al-Zahrani', '+966556667788', 'lina.z@outlook.com', 'Al-Yasmin', 'REGULAR'),
('c0000000-0000-0000-0000-000000000008', 'Youssef Al-Kahlil', '+966557778899', 'youssef@corp.sa', 'Diplomatic Quarter', 'VIP')
ON CONFLICT DO NOTHING;

-- 6. SEED 10 RESTAURANT TABLES
INSERT INTO restaurant_tables (id, table_number, capacity, status, location) VALUES
('d0000000-0000-0000-0000-000000000001', 'T-01', 2, 'AVAILABLE', 'Main Dining'),
('d0000000-0000-0000-0000-000000000002', 'T-02', 2, 'OCCUPIED', 'Main Dining'),
('d0000000-0000-0000-0000-000000000003', 'T-03', 4, 'AVAILABLE', 'Main Dining'),
('d0000000-0000-0000-0000-000000000004', 'T-04', 4, 'RESERVED', 'Main Dining'),
('d0000000-0000-0000-0000-000000000005', 'T-05', 6, 'AVAILABLE', 'Main Dining'),
('d0000000-0000-0000-0000-000000000006', 'T-06', 4, 'AVAILABLE', 'Terrace'),
('d0000000-0000-0000-0000-000000000007', 'T-07', 4, 'OCCUPIED', 'Terrace'),
('d0000000-0000-0000-0000-000000000008', 'T-08', 6, 'AVAILABLE', 'Terrace'),
('d0000000-0000-0000-0000-000000000009', 'VIP-01', 8, 'RESERVED', 'VIP Room'),
('d0000000-0000-0000-0000-000000000010', 'VIP-02', 12, 'AVAILABLE', 'VIP Room')
ON CONFLICT (table_number) DO NOTHING;

-- 7. SEED 5 SUPPLIERS
INSERT INTO suppliers (id, name, phone, email, address, tax_number, is_active) VALUES
('e0000000-0000-0000-0000-000000000001', 'Al-Watania Premium Meats', '+966114001111', 'orders@watania-meats.sa', 'Riyadh Industrial Zone 2', '310123456700003', true),
('e0000000-0000-0000-0000-000000000002', 'Fresh Produce Arabia', '+966114002222', 'supply@freshproduce.sa', 'Central Market, Riyadh', '310234567800003', true),
('e0000000-0000-0000-0000-000000000003', 'Gulf Dairy & Beverage Co.', '+966114003333', 'sales@gulfdairy.sa', 'Jeddah Highway Park', '310345678900003', true),
('e0000000-0000-0000-0000-000000000004', 'Italian Gourmet Imports', '+966114004444', 'info@italiangourmet.sa', 'Al-Khobar Logistics', '310456789000003', true),
('e0000000-0000-0000-0000-000000000005', 'Eco Packaging Solutions', '+966114005555', 'support@ecopack.sa', 'Dammam Industrial City', '310567890100003', true)
ON CONFLICT DO NOTHING;

-- 8. SEED PURCHASES & PURCHASE ITEMS (RECEIVED and DRAFT)
INSERT INTO purchases (id, supplier_id, invoice_number, subtotal, tax, total, status, purchase_date, created_by) VALUES
('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'INV-2026-001', 1800.00, 270.00, 2070.00, 'RECEIVED', CURRENT_DATE - INTERVAL '10 days', '11111111-1111-1111-1111-111111111111'),
('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'INV-2026-002', 650.00, 97.50, 747.50, 'DRAFT', CURRENT_DATE - INTERVAL '1 day', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, total_cost) VALUES
('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 100, 18.00, 1800.00),
('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000009', 100, 6.50, 650.00)
ON CONFLICT DO NOTHING;

-- 9. SEED HISTORICAL ORDERS (COMPLETED, CANCELLED, PENDING, CONFIRMED, PREPARING, READY + Split Payments + Refunded)
-- Order 1: Completed Dine-in (MADA Payment)
INSERT INTO orders (id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, stock_deducted, created_at) VALUES
('f2000000-0000-0000-0000-000000000001', 'ORD-000101', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'DINE_IN', 'COMPLETED', 142.00, 10.00, 19.80, 151.80, 'VIP Customer table', true, NOW() - INTERVAL '2 days')
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, unit_cost, discount, total) VALUES
('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 2, 45.00, 18.00, 0.00, 90.00),
('f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 1, 52.00, 16.00, 10.00, 42.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (id, order_id, payment_method, amount, status, transaction_reference) VALUES
('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'MADA', 151.80, 'PAID', 'TXN-99887766')
ON CONFLICT DO NOTHING;

-- Order 2: Completed Takeaway with Split Payment (Cash + Apple Pay)
INSERT INTO orders (id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, stock_deducted, created_at) VALUES
('f2000000-0000-0000-0000-000000000002', 'ORD-000102', 'c0000000-0000-0000-0000-000000000003', NULL, '33333333-3333-3333-3333-333333333333', 'TAKEAWAY', 'COMPLETED', 100.00, 0.00, 15.00, 115.00, 'Split payment test', true, NOW() - INTERVAL '1 day')
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, unit_cost, discount, total) VALUES
('f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 1, 58.00, 20.00, 0.00, 58.00),
('f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 1, 38.00, 14.00, 0.00, 38.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (id, order_id, payment_method, amount, status, transaction_reference) VALUES
('f4000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'CASH', 50.00, 'PAID', 'CASH-REF-01'),
('f4000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'APPLE_PAY', 65.00, 'PAID', 'APAY-99221100')
ON CONFLICT DO NOTHING;

-- Order 3: Cancelled Order (Stock Restored)
INSERT INTO orders (id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, cancelled_at, cancelled_by, cancellation_reason, stock_deducted, created_at) VALUES
('f2000000-0000-0000-0000-000000000003', 'ORD-000103', 'c0000000-0000-0000-0000-000000000004', NULL, '33333333-3333-3333-3333-333333333333', 'DELIVERY', 'CANCELLED', 72.00, 0.00, 10.80, 82.80, 'Wrong address cancellation', NOW() - INTERVAL '5 hours', '22222222-2222-2222-2222-222222222222', 'CUSTOMER_REQUEST', false, NOW() - INTERVAL '6 hours')
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, unit_cost, discount, total) VALUES
('f3000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 2, 36.00, 12.50, 0.00, 72.00)
ON CONFLICT DO NOTHING;

-- Order 4: Completed Order with REFUNDED Payment
INSERT INTO orders (id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, stock_deducted, created_at) VALUES
('f2000000-0000-0000-0000-000000000004', 'ORD-000104', 'c0000000-0000-0000-0000-000000000005', NULL, '33333333-3333-3333-3333-333333333333', 'TAKEAWAY', 'COMPLETED', 120.00, 0.00, 18.00, 138.00, 'Customer requested refund after pickup', true, NOW() - INTERVAL '3 hours')
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, unit_cost, discount, total) VALUES
('f3000000-0000-0000-0000-000000000006', 'f2000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000013', 1, 120.00, 48.00, 0.00, 120.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (id, order_id, payment_method, amount, status, transaction_reference) VALUES
('f4000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000004', 'CARD', 138.00, 'REFUNDED', 'CARD-REFUND-881')
ON CONFLICT DO NOTHING;

-- Order 5: Active PREPARING Order
INSERT INTO orders (id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, stock_deducted, created_at) VALUES
('f2000000-0000-0000-0000-000000000005', 'ORD-000105', 'c0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'DINE_IN', 'PREPARING', 85.00, 0.00, 12.75, 97.75, 'No onions', true, NOW() - INTERVAL '15 minutes')
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, unit_cost, discount, total) VALUES
('f3000000-0000-0000-0000-000000000007', 'f2000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000014', 1, 85.00, 32.00, 0.00, 85.00)
ON CONFLICT DO NOTHING;

INSERT INTO payments (id, order_id, payment_method, amount, status, transaction_reference) VALUES
('f4000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000005', 'MADA', 97.75, 'PAID', 'MADA-TXN-441122')
ON CONFLICT DO NOTHING;

COMMIT;
