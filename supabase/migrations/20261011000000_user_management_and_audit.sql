-- ============================================================================
-- RestoFlow: User Management, Role Enforcement & Audit Logging Migration
-- File: supabase/migrations/20261011000000_user_management_and_audit.sql
-- Description: Hardened RLS, privilege escalation prevention, user audit logs,
--              and role-based security enforcement for ADMIN and MANAGER roles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USER AUDIT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id),
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'USER_CREATED', 'ROLE_CHANGED', 'STATUS_CHANGED', 'PROFILE_UPDATED', 'PASSWORD_RESET_SENT', 'USER_DELETED'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_audit_actor ON user_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_target ON user_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_created ON user_audit_logs(created_at DESC);

ALTER TABLE user_audit_logs ENABLE ROW LEVEL SECURITY;

-- ADMIN and MANAGER can view audit logs
DROP POLICY IF EXISTS "Allow ADMIN and MANAGER to read user audit logs" ON user_audit_logs;
CREATE POLICY "Allow ADMIN and MANAGER to read user audit logs"
    ON user_audit_logs FOR SELECT TO authenticated
    USING (get_auth_user_role() IN ('ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS "Allow authenticated staff to insert user audit logs" ON user_audit_logs;
CREATE POLICY "Allow authenticated staff to insert user audit logs"
    ON user_audit_logs FOR INSERT TO authenticated
    WITH CHECK (get_auth_user_role() IN ('ADMIN', 'MANAGER') AND auth.uid() = actor_id);

-- ----------------------------------------------------------------------------
-- 2. HARDENED TRIGGER TO PREVENT PRIVILEGE ESCALATION ON `users`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_user_mutation_security()
RETURNS TRIGGER AS $$
DECLARE
    caller_role VARCHAR;
    admin_role_id UUID;
    manager_role_id UUID;
    cashier_role_id UUID;
    staff_role_id UUID;
    active_admin_count INT;
BEGIN
    caller_role := get_auth_user_role();
    
    SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
    SELECT id INTO manager_role_id FROM roles WHERE name = 'MANAGER';
    SELECT id INTO cashier_role_id FROM roles WHERE name = 'CASHIER';
    SELECT id INTO staff_role_id FROM roles WHERE name = 'STAFF';

    -- Rules for MANAGER:
    IF caller_role = 'MANAGER' THEN
        -- Manager cannot modify ADMIN or other MANAGER accounts
        IF OLD.role_id IN (admin_role_id, manager_role_id) AND OLD.id <> auth.uid() THEN
            RAISE EXCEPTION 'Unauthorized: Managers cannot modify Administrator or Manager accounts.';
        END IF;

        -- Manager cannot promote any user to ADMIN or MANAGER
        IF NEW.role_id IN (admin_role_id, manager_role_id) THEN
            RAISE EXCEPTION 'Unauthorized: Managers can only assign Cashier or Staff roles.';
        END IF;

        -- Manager cannot change their own account status or role
        IF OLD.id = auth.uid() AND ((OLD.role_id IS DISTINCT FROM NEW.role_id) OR (OLD.is_active IS DISTINCT FROM NEW.is_active)) THEN
            RAISE EXCEPTION 'Unauthorized: Managers cannot alter their own role or account status.';
        END IF;
    END IF;

    -- Check if role or status is being modified
    IF (OLD.role_id IS DISTINCT FROM NEW.role_id) OR (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
        
        -- Non-privileged users (CASHIER, STAFF, UNAUTHENTICATED) cannot modify roles or status
        IF caller_role NOT IN ('ADMIN', 'MANAGER') THEN
            RAISE EXCEPTION 'Unauthorized: Only Administrators and Managers can modify roles or account status.';
        END IF;

        -- Rules for ADMIN:
        IF caller_role = 'ADMIN' THEN
            -- Administrator cannot deactivate their own active account
            IF OLD.id = auth.uid() AND NEW.is_active = FALSE THEN
                RAISE EXCEPTION 'Action Denied: You cannot deactivate your own Administrator account.';
            END IF;

            -- Administrator cannot demote their own account if they are the sole admin
            IF OLD.id = auth.uid() AND NEW.role_id <> admin_role_id THEN
                SELECT count(*) INTO active_admin_count FROM users WHERE role_id = admin_role_id AND is_active = TRUE;
                IF active_admin_count <= 1 THEN
                    RAISE EXCEPTION 'Action Denied: Cannot demote the last remaining active Administrator.';
                END IF;
            END IF;

            -- Protect the last active administrator from deactivation
            IF OLD.role_id = admin_role_id AND (NEW.is_active = FALSE OR NEW.role_id <> admin_role_id) THEN
                SELECT count(*) INTO active_admin_count FROM users WHERE role_id = admin_role_id AND is_active = TRUE AND id <> OLD.id;
                IF active_admin_count = 0 THEN
                    RAISE EXCEPTION 'Action Denied: Cannot deactivate or demote the last remaining active Administrator.';
                END IF;
            END IF;
        END IF;

    END IF;

    -- Timestamp update
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_user_mutation_security ON users;
CREATE TRIGGER trg_enforce_user_mutation_security
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION enforce_user_mutation_security();

-- ----------------------------------------------------------------------------
-- 3. ENHANCED RLS POLICIES FOR USERS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow MANAGER to manage eligible staff" ON users;
CREATE POLICY "Allow MANAGER to manage eligible staff"
    ON users FOR UPDATE TO authenticated
    USING (
        get_auth_user_role() = 'MANAGER' 
        AND role_id IN (SELECT id FROM roles WHERE name IN ('CASHIER', 'STAFF'))
    )
    WITH CHECK (
        get_auth_user_role() = 'MANAGER' 
        AND role_id IN (SELECT id FROM roles WHERE name IN ('CASHIER', 'STAFF'))
    );

-- ----------------------------------------------------------------------------
-- 4. RPC: GET USER MANAGEMENT SUMMARY (Aggregates)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_management_summary()
RETURNS JSONB AS $$
DECLARE
    caller_role VARCHAR;
    result JSONB;
    total_count INT;
    active_count INT;
    inactive_count INT;
    admin_count INT;
    manager_count INT;
    cashier_count INT;
    staff_count INT;
BEGIN
    caller_role := get_auth_user_role();
    IF caller_role NOT IN ('ADMIN', 'MANAGER') THEN
        RAISE EXCEPTION 'Unauthorized access to user metrics.';
    END IF;

    SELECT count(*) INTO total_count FROM users;
    SELECT count(*) INTO active_count FROM users WHERE is_active = TRUE;
    SELECT count(*) INTO inactive_count FROM users WHERE is_active = FALSE;

    SELECT count(*) INTO admin_count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'ADMIN';
    SELECT count(*) INTO manager_count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'MANAGER';
    SELECT count(*) INTO cashier_count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'CASHIER';
    SELECT count(*) INTO staff_count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'STAFF';

    result := jsonb_build_object(
        'total_users', total_count,
        'active_users', active_count,
        'inactive_users', inactive_count,
        'admins', admin_count,
        'managers', manager_count,
        'cashiers', cashier_count,
        'staff', staff_count,
        'caller_role', caller_role
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 5. RPC: CHECK IF USER CAN BE SAFELY DELETED
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_can_delete_user(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    order_count INT := 0;
    purchase_count INT := 0;
    target_role VARCHAR;
    admin_role_id UUID;
    active_admin_count INT;
BEGIN
    -- Check order count
    SELECT count(*) INTO order_count FROM orders WHERE user_id = target_user_id OR cancelled_by = target_user_id;

    -- Check purchase count
    SELECT count(*) INTO purchase_count FROM purchases WHERE created_by = target_user_id;

    -- Check if last active admin
    SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
    SELECT r.name INTO target_role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = target_user_id;

    IF target_role = 'ADMIN' THEN
        SELECT count(*) INTO active_admin_count FROM users WHERE role_id = admin_role_id AND is_active = TRUE;
        IF active_admin_count <= 1 THEN
            RETURN jsonb_build_object(
                'can_delete', FALSE,
                'reason', 'LAST_ADMIN',
                'order_count', order_count,
                'purchase_count', purchase_count,
                'message', 'Cannot delete the last remaining active Administrator.'
            );
        END IF;
    END IF;

    IF order_count > 0 OR purchase_count > 0 THEN
        RETURN jsonb_build_object(
            'can_delete', FALSE,
            'reason', 'HISTORICAL_TRANSACTIONS',
            'order_count', order_count,
            'purchase_count', purchase_count,
            'message', 'User has linked orders or purchase records. Deactivate account instead to preserve business history.'
        );
    END IF;

    RETURN jsonb_build_object(
        'can_delete', TRUE,
        'reason', 'SAFE_TO_DELETE',
        'order_count', 0,
        'purchase_count', 0,
        'message', 'User has no linked business transactions and can be safely deleted.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
