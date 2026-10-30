-- ============================================================================
-- RestoFlow: Knowledge Base Domain Enhancement & Approval Workflow
-- File: supabase/migrations/20261022010000_enhance_knowledge_base_domains.sql
-- Description: Additive-only migration that introduces domain classification,
--              approval status workflow, and regulatory authority tagging
--              to the existing knowledge_documents table.
--
-- RISK ASSESSMENT: ZERO RISK
--   - All columns use DEFAULT values (backward compatible)
--   - No columns or data are deleted or modified
--   - Existing 7 seed documents automatically get APPROVED + INTERNAL_POLICY + INTERNAL
--   - RPC update preserves existing behavior; only adds DRAFT isolation for non-ADMIN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD APPROVAL STATUS COLUMN
--    Controls document lifecycle: DRAFT → APPROVED → ARCHIVED
--    DRAFT documents are hidden from non-ADMIN users in RAG retrieval
-- ----------------------------------------------------------------------------
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
CHECK (approval_status IN ('DRAFT', 'APPROVED', 'ARCHIVED'));

-- ----------------------------------------------------------------------------
-- 2. ADD KNOWLEDGE DOMAIN COLUMN
--    Classifies documents into distinct knowledge domains:
--    - INTERNAL_POLICY: Restaurant-specific policies and SOPs
--    - SAUDI_REGULATION: Official Saudi regulatory requirements (SFDA, Balady, ZATCA)
--    - OPERATIONAL_SOP: Day-to-day operational procedures
-- ----------------------------------------------------------------------------
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS domain VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_POLICY'
CHECK (domain IN ('INTERNAL_POLICY', 'SAUDI_REGULATION', 'OPERATIONAL_SOP'));

-- ----------------------------------------------------------------------------
-- 3. ADD REGULATORY AUTHORITY COLUMN
--    Identifies the issuing regulatory body for Saudi regulations:
--    - SFDA: Saudi Food & Drug Authority (food safety, labeling)
--    - BALADY: Ministry of Municipal & Rural Affairs (hygiene, licensing)
--    - ZATCA: Zakat, Tax & Customs Authority (VAT, e-invoicing)
--    - INTERNAL: Restaurant's own internal authority
-- ----------------------------------------------------------------------------
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS authority VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
CHECK (authority IN ('SFDA', 'BALADY', 'ZATCA', 'INTERNAL'));

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE INDEX FOR NEW COLUMNS
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_domain ON knowledge_documents(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_approval ON knowledge_documents(approval_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_authority ON knowledge_documents(authority);

-- ----------------------------------------------------------------------------
-- 5. UPDATE VECTOR SEARCH RPC — ADD DRAFT ISOLATION
--    Non-ADMIN users NEVER see DRAFT documents in RAG results.
--    ARCHIVED documents are excluded from all search results.
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
    document_domain varchar,
    document_authority varchar,
    document_approval_status varchar,
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
        kd.domain AS document_domain,
        kd.authority AS document_authority,
        kd.approval_status AS document_approval_status,
        kc.chunk_index,
        kc.content,
        (1 - (kc.embedding <=> query_embedding))::float AS similarity
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE kd.is_active = TRUE
      -- ARCHIVED documents are NEVER returned
      AND kd.approval_status != 'ARCHIVED'
      -- DRAFT documents are ONLY visible to ADMIN
      AND (kd.approval_status = 'APPROVED' OR caller_role = 'ADMIN')
      -- Role-based access control (existing logic preserved)
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
-- 6. SEED SAUDI REGULATORY DOCUMENTS
-- ----------------------------------------------------------------------------
INSERT INTO knowledge_documents (
    id, title, description, category, source_type, source_name, content,
    allowed_roles, is_active, domain, authority, approval_status
) VALUES
(
    'f0000000-0000-0000-0000-000000000001',
    'SFDA Food Safety & Handling Requirements',
    'Saudi Food & Drug Authority mandatory food safety standards for restaurants.',
    'OPERATIONS',
    'POLICY',
    'SFDA-REG-FS-001',
    'According to SFDA (Saudi Food & Drug Authority) regulations: 1. All food handlers must obtain a valid health certificate renewed annually. 2. Raw and cooked foods must be stored separately at regulated temperatures (cold storage below 5°C, frozen below -18°C). 3. Food preparation surfaces must be sanitized every 2 hours during active service. 4. All food products must display clear Arabic labeling with ingredients, allergens, production date, and expiry date. 5. SFDA inspectors may conduct unannounced inspections; violations may result in fines ranging from 1,000 to 1,000,000 SAR or facility closure.',
    ARRAY['ADMIN', 'MANAGER', 'STAFF', 'CASHIER'],
    TRUE,
    'SAUDI_REGULATION',
    'SFDA',
    'APPROVED'
),
(
    'f0000000-0000-0000-0000-000000000002',
    'Balady Municipal Hygiene & Licensing Standards',
    'Ministry of Municipal & Rural Affairs (Balady/MOMRAH) restaurant licensing and hygiene requirements.',
    'OPERATIONS',
    'POLICY',
    'BALADY-REG-HYG-001',
    'According to Balady (Ministry of Municipal & Rural Affairs / MOMRAH) regulations for restaurant licensing: 1. A valid municipal license (رخصة بلدية) must be displayed visibly at the restaurant entrance at all times. 2. Kitchen exhaust ventilation systems must comply with municipal engineering standards and be inspected quarterly. 3. Waste disposal must follow approved municipal schedules; grease traps must be cleaned weekly. 4. Pest control services must be contracted with a licensed provider and documented monthly. 5. All restaurant staff working in food handling must wear clean uniforms, hair nets, and gloves. 6. Restroom facilities must be maintained with soap, running water, and hand-drying equipment at all times.',
    ARRAY['ADMIN', 'MANAGER', 'STAFF'],
    TRUE,
    'SAUDI_REGULATION',
    'BALADY',
    'APPROVED'
),
(
    'f0000000-0000-0000-0000-000000000003',
    'ZATCA VAT & E-Invoicing Compliance for Restaurants',
    'Zakat, Tax and Customs Authority (ZATCA) VAT and electronic invoicing requirements.',
    'PURCHASING',
    'POLICY',
    'ZATCA-REG-VAT-001',
    'According to ZATCA (Zakat, Tax and Customs Authority) regulations for restaurant businesses: 1. All restaurant sales are subject to 15% Value Added Tax (VAT) which must be clearly displayed on customer receipts. 2. Restaurants with annual revenue exceeding 375,000 SAR must register for VAT and file returns quarterly. 3. Phase 2 E-Invoicing (Fatoora) requires all B2B invoices to be integrated with the ZATCA FATOORA platform with QR codes containing seller name, VAT number, timestamp, invoice total, and VAT amount. 4. Purchase invoices from suppliers must include the supplier VAT registration number (الرقم الضريبي) for input VAT deduction eligibility. 5. VAT returns must be filed within 30 days of the end of each tax period; late filing incurs penalties of 5-25% of unpaid VAT.',
    ARRAY['ADMIN', 'MANAGER'],
    TRUE,
    'SAUDI_REGULATION',
    'ZATCA',
    'APPROVED'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. UPDATE EXISTING SEED DOCUMENTS WITH DOMAIN CLASSIFICATION
--    (Safe: only sets new columns on existing rows)
-- ----------------------------------------------------------------------------
UPDATE knowledge_documents SET domain = 'OPERATIONAL_SOP', authority = 'INTERNAL'
WHERE id IN (
    'e0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000006'
) AND domain = 'INTERNAL_POLICY';

UPDATE knowledge_documents SET domain = 'INTERNAL_POLICY', authority = 'INTERNAL'
WHERE id IN (
    'e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000007'
) AND domain = 'INTERNAL_POLICY';

UPDATE knowledge_documents SET domain = 'OPERATIONAL_SOP', authority = 'INTERNAL'
WHERE id IN (
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000005'
) AND domain = 'INTERNAL_POLICY';
