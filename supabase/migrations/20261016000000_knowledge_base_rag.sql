-- ============================================================================
-- RestoFlow: Knowledge Base & RAG Vector Schema Setup
-- File: supabase/migrations/20261016000000_knowledge_base_rag.sql
-- Description: DDL for knowledge_documents, knowledge_chunks, pgvector search,
--              Row Level Security, role filtering, and atomic search RPC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. KNOWLEDGE DOCUMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'OPERATIONS',
        'INVENTORY',
        'PURCHASING',
        'POS',
        'MANAGEMENT',
        'CANCELLATION_REFUND',
        'HR',
        'GENERAL'
    )),
    source_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL_TEXT' CHECK (source_type IN (
        'MANUAL_TEXT',
        'POLICY',
        'SOP',
        'FAQ',
        'CSV',
        'PDF',
        'DOCX'
    )),
    source_name VARCHAR(255),
    content TEXT NOT NULL,
    allowed_roles VARCHAR(50)[] NOT NULL DEFAULT ARRAY['ADMIN', 'MANAGER']::VARCHAR(50)[],
    chunk_count INT NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. KNOWLEDGE CHUNKS TABLE (VECTOR EMBEDDINGS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE & VECTOR SEARCH INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_active ON knowledge_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_created_at ON knowledge_chunks(created_at);

-- Vector Cosine Distance Index using IVFFLAT (or fallback to basic index)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_chunks_embedding'
    ) THEN
        CREATE INDEX idx_knowledge_chunks_embedding
        ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- In small or newly initialized databases, IVFFLAT list creation requires rows.
    -- If error occurs, create HNSW or continue gracefully.
    RAISE NOTICE 'Vector index creation notice: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 5. VECTOR SIMILARITY SEARCH RPC (ROLE-FILTERED)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.50,
    match_count int DEFAULT 5,
    caller_role varchar DEFAULT 'STAFF'
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    document_title varchar,
    document_category varchar,
    document_source varchar,
    chunk_index int,
    content text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.document_id,
        kd.title AS document_title,
        kd.category AS document_category,
        kd.source_name AS document_source,
        kc.chunk_index,
        kc.content,
        (1 - (kc.embedding <=> query_embedding))::float AS similarity
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE kd.is_active = TRUE
      AND (
          caller_role = ANY(kd.allowed_roles)
          OR 'ALL' = ANY(kd.allowed_roles)
          OR caller_role = 'ADMIN'
      )
      AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff can read documents if their role is in allowed_roles or they are ADMIN
CREATE POLICY "knowledge_documents_select_policy"
    ON knowledge_documents FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE AND (
            EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = auth.uid() AND (
                    r.name = ANY(knowledge_documents.allowed_roles)
                    OR r.name = 'ADMIN'
                    OR 'ALL' = ANY(knowledge_documents.allowed_roles)
                )
            )
        )
    );

-- Write policies: Only ADMIN and MANAGER can create or modify knowledge documents
CREATE POLICY "knowledge_documents_admin_all_policy"
    ON knowledge_documents FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('ADMIN', 'MANAGER')
        )
    );

-- Read policy for chunks: Same role check as parent document
CREATE POLICY "knowledge_chunks_select_policy"
    ON knowledge_chunks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_documents kd
            WHERE kd.id = knowledge_chunks.document_id
            AND kd.is_active = TRUE
            AND (
                EXISTS (
                    SELECT 1 FROM users u
                    JOIN roles r ON u.role_id = r.id
                    WHERE u.id = auth.uid() AND (
                        r.name = ANY(kd.allowed_roles)
                        OR r.name = 'ADMIN'
                        OR 'ALL' = ANY(kd.allowed_roles)
                    )
                )
            )
        )
    );

-- Write policy for chunks: ADMIN and MANAGER
CREATE POLICY "knowledge_chunks_admin_all_policy"
    ON knowledge_chunks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('ADMIN', 'MANAGER')
        )
    );

-- ----------------------------------------------------------------------------
-- 7. INITIAL FOUNDATIONAL OPERATIONAL DOCUMENTS (SEED DATA)
-- ----------------------------------------------------------------------------
INSERT INTO knowledge_documents (
    id, title, description, category, source_type, source_name, content, allowed_roles, is_active
) VALUES
(
    'e0000000-0000-0000-0000-000000000001',
    'Order Cancellation & Inventory Restoration Policy',
    'Standard operating procedure for handling order cancellations and stock return.',
    'CANCELLATION_REFUND',
    'POLICY',
    'RestoFlow SOP-OPS-001',
    'Orders can be cancelled before food preparation begins or in special customer request cases. When an order is cancelled in RestoFlow: 1. A mandatory cancellation reason must be recorded (e.g., Customer Request, Item Out of Stock, Duplicate Order). 2. Inventory quantities for every order item are atomically restored to the physical stock balance immediately. 3. If payment was already collected, a formal refund workflow must be initiated. Staff must never discard cancelled food items without logging waste.',
    ARRAY['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000002',
    'Customer Payment Refund & Financial Audit Guidelines',
    'Guidelines for issuing customer refunds and reconciliation.',
    'CANCELLATION_REFUND',
    'POLICY',
    'RestoFlow SOP-FIN-002',
    'Refunds are strictly permitted for orders where quality standards were unmet or billing discrepancies occurred. 1. Only Cashiers with authorization or Managers may process refunds. 2. Card and MADA payments must be refunded back to the original payment method where supported. 3. The refund transaction is recorded in the audit log and updates the payment status to REFUNDED. 4. Cash refunds require an explicit receipt signed by the manager on duty.',
    ARRAY['ADMIN', 'MANAGER', 'CASHIER'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000003',
    'Inventory Thresholds & Automated Reorder Policy',
    'Procedures for tracking minimum stock balances and purchase triggers.',
    'INVENTORY',
    'SOP',
    'RestoFlow SOP-INV-003',
    'Every restaurant menu item has a designated minimum stock alert threshold (default 5 units). When current stock drops to or below the minimum threshold: 1. The inventory dashboard displays a Low Stock warning badge. 2. A purchase order must be drafted to the designated supplier within 24 hours. 3. If stock reaches zero, the POS system automatically marks the product as Out of Stock to prevent unfulfillable orders. Physical stock counts must be audited weekly.',
    ARRAY['ADMIN', 'MANAGER', 'STAFF'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000004',
    'Procurement & Goods Receiving Procedure',
    'Receiving supplier deliveries and atomic stock incrementation.',
    'PURCHASING',
    'SOP',
    'RestoFlow SOP-PUR-004',
    'Upon supplier delivery: 1. The receiving manager must verify the delivery note against the RestoFlow Purchase Order. 2. Inspect packaging, temperature, and product quality. 3. Confirm quantities in the RestoFlow Purchases module and click Receive Stock. 4. Receiving atomically increments physical inventory stock counts and captures VAT (15%) invoice totals into purchasing cost history.',
    ARRAY['ADMIN', 'MANAGER'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000005',
    'POS Cash Drawer & End-of-Day Terminal Closing SOP',
    'Cashier shift handover and terminal balancing.',
    'POS',
    'SOP',
    'RestoFlow SOP-POS-005',
    'At the end of each cashier shift: 1. Reconcile physical cash drawer contents against the RestoFlow daily payment breakdown (Cash, MADA, Credit Card, Apple Pay). 2. Discrepancies greater than 20 SAR must be documented and signed by the shift supervisor. 3. The cashier must complete all open pending table tickets before terminal handover. 4. Lock the terminal screen upon departure.',
    ARRAY['ADMIN', 'MANAGER', 'CASHIER'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000006',
    'Dining Hall Table Turnover & Cleanliness Standards',
    'Table reservations, turnover speed, and sanitization.',
    'OPERATIONS',
    'SOP',
    'RestoFlow SOP-TBL-006',
    'Dining tables transition across four operational states: AVAILABLE, OCCUPIED, RESERVED, and CLEANING. 1. Floor staff must seat guests within 2 minutes of arrival. 2. Once guests vacate, table status must be updated to CLEANING. 3. Sanitize table surface, reset cutlery, and switch status back to AVAILABLE within 3 minutes. 4. Reserved tables must be held up to 15 minutes past reservation time.',
    ARRAY['ADMIN', 'MANAGER', 'STAFF', 'CASHIER'],
    TRUE
),
(
    'e0000000-0000-0000-0000-000000000007',
    'Executive Management KPI & Margin Strategy',
    'Strategic guidelines for target gross margins, ticket sizes, and revenue targets.',
    'MANAGEMENT',
    'POLICY',
    'RestoFlow SOP-MGT-007',
    'Management targets a minimum gross profit margin of 60% across all food categories and 75% for beverage categories. Average Order Value (AOV) must be monitored daily on the BI Dashboard. Cancellation rates exceeding 3% require an operational review with the kitchen manager. VIP customer profiles must be greeted by the manager on duty and are eligible for 10% complimentary discounts.',
    ARRAY['ADMIN', 'MANAGER'],
    TRUE
)
ON CONFLICT (id) DO NOTHING;
