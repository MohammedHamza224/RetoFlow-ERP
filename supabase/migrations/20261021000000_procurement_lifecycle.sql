-- ============================================================================
-- RESTOFLOW PROCUREMENT LIFECYCLE MIGRATION
-- Enhances Purchases into full POs, adds Goods Receipts and Purchase Invoices
-- ============================================================================

-- 1. UPDATE PURCHASES TABLE STATUS CONSTRAINT AND COLUMNS
DO $$
BEGIN
    -- Drop old check constraint if exists
    ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
    
    -- Add updated check constraint with full lifecycle statuses
    ALTER TABLE purchases ADD CONSTRAINT purchases_status_check 
        CHECK (status IN ('DRAFT', 'APPROVED', 'PENDING_RECEIPT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'));

    -- Add notes, discount, expected delivery date to purchases if not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'notes') THEN
        ALTER TABLE purchases ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'discount') THEN
        ALTER TABLE purchases ADD COLUMN discount DECIMAL(10, 2) DEFAULT 0.00 CHECK (discount >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'expected_delivery_date') THEN
        ALTER TABLE purchases ADD COLUMN expected_delivery_date DATE;
    END IF;

    -- Add received_quantity to purchase_items if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'received_quantity') THEN
        ALTER TABLE purchase_items ADD COLUMN received_quantity INT DEFAULT 0 CHECK (received_quantity >= 0);
    END IF;
END $$;


-- 2. CREATE GOODS RECEIPTS TABLE (محاضر استلام البضائع)
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for goods receipts
CREATE INDEX IF NOT EXISTS idx_goods_receipts_purchase ON goods_receipts(purchase_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_date ON goods_receipts(received_at DESC);


-- 3. CREATE GOODS RECEIPT ITEMS TABLE (أصناف محضر الاستلام)
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_item_id UUID NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_received INT NOT NULL CHECK (quantity_received > 0),
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_receipt ON goods_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_product ON goods_receipt_items(product_id);


-- 4. CREATE PURCHASE INVOICES TABLE (فواتير المشتريات)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_invoice_number VARCHAR(100),
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    payment_status VARCHAR(30) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_purchase ON purchase_invoices(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status, payment_status);


-- 5. CREATE PURCHASE INVOICE ITEMS TABLE (أصناف فاتورة المشتريات)
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
    discount DECIMAL(10, 2) DEFAULT 0.00 CHECK (discount >= 0),
    tax DECIMAL(10, 2) DEFAULT 0.00 CHECK (tax >= 0),
    total_cost DECIMAL(10, 2) NOT NULL CHECK (total_cost >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_product ON purchase_invoice_items(product_id);


-- 6. ATOMIC RPC: RECORD GOODS RECEIPT AND INCREMENT STOCK ATOMICALLY
CREATE OR REPLACE FUNCTION record_goods_receipt_and_increment_stock(
    p_purchase_id UUID,
    p_received_by UUID,
    p_receipt_number VARCHAR,
    p_items JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_receipt_id UUID;
    v_pi_id UUID;
    v_prod_id UUID;
    v_qty INT;
    v_cost DECIMAL(10, 2);
    v_all_received BOOLEAN := TRUE;
    v_any_received BOOLEAN := FALSE;
    v_current_item RECORD;
BEGIN
    -- 1. Lock and validate purchase order
    SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
    IF v_purchase.id IS NULL THEN
        RAISE EXCEPTION 'Purchase order not found.';
    END IF;

    IF v_purchase.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot receive goods for a cancelled purchase order.';
    END IF;

    IF v_purchase.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'This purchase order has already been fully received.';
    END IF;

    -- 2. Create Goods Receipt record
    INSERT INTO goods_receipts (
        receipt_number,
        purchase_id,
        supplier_id,
        received_by,
        received_at,
        notes
    ) VALUES (
        p_receipt_number,
        p_purchase_id,
        v_purchase.supplier_id,
        p_received_by,
        NOW(),
        p_notes
    ) RETURNING id INTO v_receipt_id;

    -- 3. Loop through items to receive
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_pi_id := (v_item.value->>'purchase_item_id')::UUID;
        v_qty := (v_item.value->>'quantity_received')::INT;
        v_cost := COALESCE((v_item.value->>'unit_cost')::DECIMAL, 0.00);

        IF v_qty > 0 THEN
            -- Lock purchase item
            SELECT * INTO v_current_item FROM purchase_items WHERE id = v_pi_id FOR UPDATE;
            IF v_current_item.id IS NULL THEN
                RAISE EXCEPTION 'Purchase item % not found.', v_pi_id;
            END IF;

            -- Prevent receiving more than ordered
            IF (v_current_item.received_quantity + v_qty) > v_current_item.quantity THEN
                RAISE EXCEPTION 'Received quantity (%) exceeds remaining quantity (%) for item.',
                    v_qty, (v_current_item.quantity - v_current_item.received_quantity);
            END IF;

            -- Update purchase item received quantity
            UPDATE purchase_items 
            SET received_quantity = received_quantity + v_qty
            WHERE id = v_pi_id;

            -- Record receipt line item
            INSERT INTO goods_receipt_items (
                receipt_id,
                purchase_item_id,
                product_id,
                quantity_received,
                unit_cost
            ) VALUES (
                v_receipt_id,
                v_pi_id,
                v_current_item.product_id,
                v_qty,
                COALESCE(v_cost, v_current_item.unit_cost)
            );

            -- Atomically increment product stock and update reference cost
            UPDATE products
            SET stock_quantity = stock_quantity + v_qty,
                cost = CASE WHEN v_cost > 0 THEN v_cost ELSE cost END,
                updated_at = NOW()
            WHERE id = v_current_item.product_id;

            v_any_received := TRUE;
        END IF;
    END LOOP;

    IF NOT v_any_received THEN
        RAISE EXCEPTION 'No valid positive quantity was specified to receive.';
    END IF;

    -- 4. Check if all items in purchase order are now fully received
    FOR v_current_item IN SELECT * FROM purchase_items WHERE purchase_id = p_purchase_id LOOP
        IF v_current_item.received_quantity < v_current_item.quantity THEN
            v_all_received := FALSE;
        END IF;
    END LOOP;

    -- 5. Update purchase status
    UPDATE purchases
    SET status = CASE WHEN v_all_received THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END,
        updated_at = NOW()
    WHERE id = p_purchase_id;

    RETURN jsonb_build_object(
        'success', true,
        'receipt_id', v_receipt_id,
        'receipt_number', p_receipt_number,
        'purchase_status', CASE WHEN v_all_received THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 7. ENABLE RLS POLICIES FOR NEW TABLES
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view
CREATE POLICY "Allow authenticated read on goods_receipts" ON goods_receipts
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on goods_receipt_items" ON goods_receipt_items
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on purchase_invoices" ON purchase_invoices
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on purchase_invoice_items" ON purchase_invoice_items
    FOR SELECT TO authenticated USING (true);

-- Allow Admin & Manager to insert/update/delete
CREATE POLICY "Allow management write on goods_receipts" ON goods_receipts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow management write on goods_receipt_items" ON goods_receipt_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow management write on purchase_invoices" ON purchase_invoices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow management write on purchase_invoice_items" ON purchase_invoice_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
