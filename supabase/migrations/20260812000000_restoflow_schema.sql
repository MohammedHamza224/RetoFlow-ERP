-- ============================================================================
-- RestoFlow: Database Migration & Schema Setup (Security Hardened)
-- File: supabase/migrations/20260812000000_restoflow_schema.sql
-- Description: Complete DDL for 12 Core Tables, Sequences, Indexes, RLS, & Atomic RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS & SEQUENCES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Business Order Number Sequence (Generates ORD-000001, ORD-000002, etc.)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 1. CORE 12 TABLES
-- ----------------------------------------------------------------------------

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Users Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    minimum_stock INT NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    customer_type VARCHAR(20) DEFAULT 'GUEST' CHECK (customer_type IN ('GUEST', 'REGULAR', 'VIP')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Restaurant Tables Table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED')),
    location VARCHAR(50) DEFAULT 'Main Dining',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL DEFAULT concat('ORD-', lpad(nextval('order_number_seq')::text, 6, '0')),
    customer_id UUID REFERENCES customers(id),
    table_id UUID REFERENCES restaurant_tables(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount DECIMAL(10, 2) DEFAULT 0.00 CHECK (discount >= 0),
    tax DECIMAL(10, 2) DEFAULT 0.00 CHECK (tax >= 0),
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    notes TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason VARCHAR(50) CHECK (cancellation_reason IN ('CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'WRONG_ORDER', 'OTHER', NULL)),
    stock_deducted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Order Items Table (With Snapshot unit_cost for Historical Profit Accuracy)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
    discount DECIMAL(10, 2) DEFAULT 0.00 CHECK (discount >= 0),
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'MADA', 'APPLE_PAY', 'OTHER')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) DEFAULT 'PAID' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    transaction_reference VARCHAR(100),
    paid_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    tax_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax DECIMAL(10, 2) DEFAULT 0.00 CHECK (tax >= 0),
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RECEIVED', 'CANCELLED')),
    purchase_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cost DECIMAL(10, 2) NOT NULL CHECK (total_cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_customer ON orders(user_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Helper Function: Get Authenticated User's Role Name
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS VARCHAR AS $$
DECLARE
    role_name VARCHAR;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'UNAUTHENTICATED';
    END IF;

    SELECT r.name INTO role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
    
    RETURN COALESCE(role_name, 'UNAUTHENTICATED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS Policies: Roles & Users (ADMIN full; others read)
CREATE POLICY "Allow read access to roles for authenticated users"
    ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to users for authenticated users"
    ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow ADMIN full management of users"
    ON users FOR ALL TO authenticated
    USING (get_auth_user_role() = 'ADMIN');

CREATE POLICY "Allow users to update own profile"
    ON users FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- RLS Policies: Categories & Products (All authenticated read; ADMIN/MANAGER write)
CREATE POLICY "Allow read categories for authenticated users"
    ON categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow ADMIN and MANAGER to modify categories"
    ON categories FOR ALL TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Allow read products for authenticated users"
    ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow ADMIN and MANAGER to modify products"
    ON products FOR ALL TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

-- RLS Policies: Customers & Tables (All staff read and modify)
CREATE POLICY "Allow staff to access customers"
    ON customers FOR ALL TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow staff to access restaurant tables"
    ON restaurant_tables FOR ALL TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

-- RLS Policies: Orders & Order Items (All staff read and insert)
CREATE POLICY "Allow staff to read orders"
    ON orders FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow staff to insert orders"
    ON orders FOR INSERT TO authenticated WITH CHECK (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow staff to update orders"
    ON orders FOR UPDATE TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow staff to access order items"
    ON order_items FOR ALL TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

-- RLS Policies: Payments (Read for all staff; insert for CASHIER/MANAGER/ADMIN; refund for ADMIN/MANAGER)
CREATE POLICY "Allow staff to read payments"
    ON payments FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow cashier, manager, admin to insert payments"
    ON payments FOR INSERT TO authenticated
    WITH CHECK (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER'));

CREATE POLICY "Allow admin and manager to update payments"
    ON payments FOR UPDATE TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

-- RLS Policies: Suppliers & Purchases (ADMIN & MANAGER write; Staff read)
CREATE POLICY "Allow staff read suppliers"
    ON suppliers FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow ADMIN and MANAGER write suppliers"
    ON suppliers FOR ALL TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Allow staff read purchases"
    ON purchases FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow ADMIN and MANAGER write purchases"
    ON purchases FOR ALL TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Allow staff read purchase items"
    ON purchase_items FOR SELECT TO authenticated USING (get_auth_user_role() IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'));

CREATE POLICY "Allow ADMIN and MANAGER write purchase items"
    ON purchase_items FOR ALL TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

-- ----------------------------------------------------------------------------
-- 4. ATOMIC POSTGRESQL STORED PROCEDURES (RPCs)
-- ----------------------------------------------------------------------------

-- RPC 1: ATOMIC POS CHECKOUT
CREATE OR REPLACE FUNCTION execute_pos_checkout(
    p_user_id UUID,
    p_customer_id UUID,
    p_table_id UUID,
    p_order_type VARCHAR,
    p_items JSONB,             -- Array of { product_id, quantity, discount, notes }
    p_payments JSONB,          -- Array of { payment_method, amount, transaction_reference }
    p_discount DECIMAL DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_vat_rate DECIMAL DEFAULT 15.00
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_order_number VARCHAR(20);
    v_item RECORD;
    v_payment RECORD;
    v_product RECORD;
    v_subtotal DECIMAL(10, 2) := 0.00;
    v_taxable DECIMAL(10, 2) := 0.00;
    v_vat_amount DECIMAL(10, 2) := 0.00;
    v_total DECIMAL(10, 2) := 0.00;
    v_payment_sum DECIMAL(10, 2) := 0.00;
    v_item_total DECIMAL(10, 2) := 0.00;
    v_user_role VARCHAR;
BEGIN
    -- 0. Explicit Security Authentication & Authorization Validation
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required for POS checkout.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" is not permitted to perform POS checkout.', v_user_role;
    END IF;

    -- 1. Validate parameters
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order checkout failed: Order must contain at least one item.';
    END IF;

    IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'Order checkout failed: At least one valid payment is required.';
    END IF;

    -- 2. Validate Payment Total matches requested amounts
    FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(payment_method VARCHAR, amount DECIMAL, transaction_reference VARCHAR) LOOP
        IF v_payment.amount <= 0 THEN
            RAISE EXCEPTION 'Order checkout failed: Payment amount must be greater than zero.';
        END IF;
        v_payment_sum := v_payment_sum + v_payment.amount;
    END LOOP;

    -- 3. Calculate Item Subtotals with Row Locking (SELECT ... FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, discount DECIMAL, notes TEXT) LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Order checkout failed: Quantity must be greater than zero.';
        END IF;

        -- Lock product row to prevent race conditions
        SELECT * INTO v_product FROM products WHERE id = v_item.product_id FOR UPDATE;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Order checkout failed: Product ID % not found.', v_item.product_id;
        END IF;

        IF NOT v_product.is_active THEN
            RAISE EXCEPTION 'Order checkout failed: Product "%" is inactive.', v_product.name;
        END IF;

        IF v_product.stock_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Order checkout failed: Insufficient stock for "%". Required: %, Available: %.', 
                v_product.name, v_item.quantity, v_product.stock_quantity;
        END IF;

        v_item_total := (v_product.price * v_item.quantity) - COALESCE(v_item.discount, 0);
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    -- 4. Calculate Financial Breakdown (Taxable = Subtotal - Discount)
    v_taxable := GREATEST(0.00, v_subtotal - COALESCE(p_discount, 0.00));
    v_vat_amount := ROUND((v_taxable * (p_vat_rate / 100.00)), 2);
    v_total := ROUND(v_taxable + v_vat_amount, 2);

    -- 5. Validate Payment Sum equals Order Total
    IF ABS(v_payment_sum - v_total) > 0.01 THEN
        RAISE EXCEPTION 'Order checkout failed: Payment sum (%) does not equal order total (%).', v_payment_sum, v_total;
    END IF;

    -- 6. Insert Order Record
    INSERT INTO orders (
        customer_id, table_id, user_id, order_type, status,
        subtotal, discount, tax, total, notes, stock_deducted
    ) VALUES (
        p_customer_id, p_table_id, p_user_id, p_order_type, 'CONFIRMED',
        v_subtotal, COALESCE(p_discount, 0.00), v_vat_amount, v_total, p_notes, TRUE
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    -- 7. Insert Order Items & Deduct Stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, discount DECIMAL, notes TEXT) LOOP
        SELECT * INTO v_product FROM products WHERE id = v_item.product_id;
        v_item_total := (v_product.price * v_item.quantity) - COALESCE(v_item.discount, 0);

        -- Insert item with snapshot price AND unit_cost
        INSERT INTO order_items (
            order_id, product_id, quantity, unit_price, unit_cost, discount, total, notes
        ) VALUES (
            v_order_id, v_item.product_id, v_item.quantity, v_product.price, v_product.cost,
            COALESCE(v_item.discount, 0.00), v_item_total, v_item.notes
        );

        -- Atomically deduct stock
        UPDATE products 
        SET stock_quantity = stock_quantity - v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.product_id;
    END LOOP;

    -- 8. Insert Payment Records
    FOR v_payment IN SELECT * FROM jsonb_to_recordset(p_payments) AS x(payment_method VARCHAR, amount DECIMAL, transaction_reference VARCHAR) LOOP
        INSERT INTO payments (
            order_id, payment_method, amount, status, transaction_reference
        ) VALUES (
            v_order_id, v_payment.payment_method, v_payment.amount, 'PAID', v_payment.transaction_reference
        );
    END LOOP;

    -- 9. Update Table Status if DINE_IN
    IF p_table_id IS NOT NULL AND p_order_type = 'DINE_IN' THEN
        UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = p_table_id;
    END IF;

    -- 10. Return Created Order Details
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total', v_total,
        'status', 'CONFIRMED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 2: ATOMIC IDEMPOTENT ORDER CANCELLATION & STOCK REVERSAL
CREATE OR REPLACE FUNCTION cancel_order_and_restore_stock(
    p_order_id UUID,
    p_cancelled_by UUID,
    p_reason VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_user_role VARCHAR;
BEGIN
    -- 0. Security Authorization Validation
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required for order cancellation.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER', 'CASHIER') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" is not permitted to cancel orders.', v_user_role;
    END IF;

    -- 1. Fetch Order Record with Lock
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Cancellation failed: Order ID not found.';
    END IF;

    -- 2. Check State Transition Constraints
    IF v_order.status = 'CANCELLED' THEN
        -- Already cancelled (Idempotent success response without double stock restoration)
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Order was already cancelled. Stock was not modified.',
            'order_id', v_order.id,
            'order_number', v_order.order_number
        );
    END IF;

    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Cancellation failed: Completed orders cannot be cancelled. Use payment refund flow instead.';
    END IF;

    IF p_reason IS NULL OR p_reason NOT IN ('CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'WRONG_ORDER', 'OTHER') THEN
        RAISE EXCEPTION 'Cancellation failed: Valid cancellation reason required.';
    END IF;

    -- 3. Restore Stock iff stock_deducted is TRUE
    IF v_order.stock_deducted THEN
        FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
            UPDATE products 
            SET stock_quantity = stock_quantity + v_item.quantity,
                updated_at = NOW()
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;

    -- 4. Update Order Cancellation Metadata & Reset stock_deducted flag
    UPDATE orders
    SET status = 'CANCELLED',
        cancelled_at = NOW(),
        cancelled_by = p_cancelled_by,
        cancellation_reason = p_reason,
        stock_deducted = FALSE,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 5. Release Table if attached
    IF v_order.table_id IS NOT NULL THEN
        UPDATE restaurant_tables SET status = 'AVAILABLE', updated_at = NOW() WHERE id = v_order.table_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order cancelled and stock restored successfully.',
        'order_id', v_order.id,
        'order_number', v_order.order_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 3: STRICT ORDER STATE MACHINE ADVANCE
CREATE OR REPLACE FUNCTION advance_order_status(
    p_order_id UUID,
    p_new_status VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_current_status VARCHAR;
    v_user_role VARCHAR;
BEGIN
    -- 0. Security Authorization Validation
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" is not permitted to advance order status.', v_user_role;
    END IF;

    SELECT status INTO v_current_status FROM orders WHERE id = p_order_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'State transition failed: Order not found.';
    END IF;

    -- Validate Strict State Machine Transition Matrix
    IF (v_current_status = 'PENDING' AND p_new_status = 'CONFIRMED') OR
       (v_current_status = 'CONFIRMED' AND p_new_status = 'PREPARING') OR
       (v_current_status = 'PREPARING' AND p_new_status = 'READY') OR
       (v_current_status = 'READY' AND p_new_status = 'COMPLETED') THEN
        
        UPDATE orders SET status = p_new_status, updated_at = NOW() WHERE id = p_order_id;

        -- Release table when order reaches COMPLETED
        IF p_new_status = 'COMPLETED' THEN
            UPDATE restaurant_tables rt
            SET status = 'AVAILABLE', updated_at = NOW()
            FROM orders o
            WHERE o.id = p_order_id AND rt.id = o.table_id;
        END IF;

        RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
    ELSE
        RAISE EXCEPTION 'Illegal order state transition: Cannot transition from % to %.', v_current_status, p_new_status;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 4: REFUND COMPLETED PAYMENT
CREATE OR REPLACE FUNCTION refund_completed_payment(
    p_order_id UUID,
    p_refunded_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_user_role VARCHAR;
BEGIN
    -- 0. Security Authorization Validation (Restricted to ADMIN and MANAGER)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" is not authorized to refund payments. Requires ADMIN or MANAGER.', v_user_role;
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Refund failed: Order not found.';
    END IF;

    IF v_order.status != 'COMPLETED' THEN
        RAISE EXCEPTION 'Refund failed: Only COMPLETED orders can be refunded.';
    END IF;

    -- Update Payment status to REFUNDED (Order record remains COMPLETED for audit log)
    UPDATE payments SET status = 'REFUNDED' WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment status updated to REFUNDED. Order transaction history preserved.',
        'order_id', p_order_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 5: ATOMIC PURCHASE RECEIVING & STOCK INCREMENT
CREATE OR REPLACE FUNCTION receive_purchase_and_increment_stock(
    p_purchase_id UUID,
    p_received_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_user_role VARCHAR;
BEGIN
    -- 0. Security Authorization Validation (Restricted to ADMIN and MANAGER)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" is not authorized to receive purchases. Requires ADMIN or MANAGER.', v_user_role;
    END IF;

    SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;

    IF v_purchase.id IS NULL THEN
        RAISE EXCEPTION 'Purchase receiving failed: Purchase order not found.';
    END IF;

    IF v_purchase.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'Purchase receiving failed: Purchase order has already been received.';
    END IF;

    IF v_purchase.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Purchase receiving failed: Cannot receive a cancelled purchase order.';
    END IF;

    -- Update purchase status
    UPDATE purchases 
    SET status = 'RECEIVED', updated_at = NOW() 
    WHERE id = p_purchase_id;

    -- Increment stock for each purchased product
    FOR v_item IN SELECT * FROM purchase_items WHERE purchase_id = p_purchase_id LOOP
        UPDATE products
        SET stock_quantity = stock_quantity + v_item.quantity,
            cost = v_item.unit_cost, -- Update product unit cost reference
            updated_at = NOW()
        WHERE id = v_item.product_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Purchase received and product stock incremented successfully.',
        'purchase_id', p_purchase_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 6: CENTRALIZED BUSINESS METRICS VIEW FUNCTION (REFUND-AWARE & HISTORICAL COST-AWARE)
CREATE OR REPLACE FUNCTION get_business_metrics(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_revenue DECIMAL,
    completed_orders_count INT,
    average_order_value DECIMAL,
    cancelled_orders_count INT,
    cancellation_rate DECIMAL,
    gross_profit DECIMAL,
    top_selling_product_name VARCHAR,
    inventory_low_stock_count INT
) AS $$
DECLARE
    v_user_role VARCHAR;
BEGIN
    -- 0. Security Authorization Validation (Restricted to ADMIN and MANAGER)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required for Business Analytics.';
    END IF;

    v_user_role := get_auth_user_role();
    IF v_user_role NOT IN ('ADMIN', 'MANAGER') THEN
        RAISE EXCEPTION 'Unauthorized: Access to Business Analytics is restricted to ADMIN and MANAGER roles.';
    END IF;

    RETURN QUERY
    WITH net_payments AS (
        -- Exclude refunded payments from total completed revenue
        SELECT 
            o.id AS order_id,
            o.total AS order_total,
            p.status AS payment_status
        FROM orders o
        JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'COMPLETED'
          AND p.status = 'PAID'
          AND o.created_at BETWEEN start_date AND end_date
    ),
    completed_stats AS (
        SELECT 
            COALESCE(SUM(order_total), 0) AS rev,
            COUNT(DISTINCT order_id) AS cnt,
            COALESCE(AVG(order_total), 0) AS aov
        FROM net_payments
    ),
    cancelled_stats AS (
        SELECT COUNT(*) AS cnt
        FROM orders
        WHERE status = 'CANCELLED'
          AND created_at BETWEEN start_date AND end_date
    ),
    all_stats AS (
        SELECT COUNT(*) AS cnt
        FROM orders
        WHERE created_at BETWEEN start_date AND end_date
    ),
    profit_stats AS (
        -- Calculate gross profit using historical oi.unit_cost snapshot
        SELECT COALESCE(SUM((oi.unit_price - oi.unit_cost) * oi.quantity), 0) AS profit
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'COMPLETED'
          AND p.status = 'PAID'
          AND o.created_at BETWEEN start_date AND end_date
    ),
    top_product AS (
        SELECT pr.name
        FROM order_items oi
        JOIN products pr ON oi.product_id = pr.id
        JOIN orders o ON oi.order_id = o.id
        JOIN payments p ON p.order_id = o.id
        WHERE o.status = 'COMPLETED'
          AND p.status = 'PAID'
          AND o.created_at BETWEEN start_date AND end_date
        GROUP BY pr.name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 1
    ),
    low_stock AS (
        SELECT COUNT(*)::INT AS cnt
        FROM products
        WHERE is_active = TRUE AND stock_quantity <= minimum_stock
    )
    SELECT 
        cs.rev,
        cs.cnt::INT,
        cs.aov,
        can.cnt::INT,
        CASE WHEN als.cnt > 0 THEN ROUND((can.cnt::DECIMAL / als.cnt) * 100, 2) ELSE 0 END,
        ps.profit,
        COALESCE((SELECT name FROM top_product), 'N/A'),
        ls.cnt
    FROM completed_stats cs, cancelled_stats can, all_stats als, profit_stats ps, low_stock ls;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
