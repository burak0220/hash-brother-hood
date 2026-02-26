-- Sprint 1 Migration: MRR Feature Parity
-- Run this against your PostgreSQL database

-- =============================================
-- 1. RIG: Add RPI score, suggested difficulty, auto pricing
-- =============================================
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS rpi_score NUMERIC(6,2) DEFAULT 100.00;
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS suggested_difficulty VARCHAR(100);
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS auto_price_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS auto_price_margin NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS owner_pool_url VARCHAR(500);
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS owner_pool_user VARCHAR(255);
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS owner_pool_password VARCHAR(255) DEFAULT 'x';

-- =============================================
-- 2. RENTAL: Add pool 4-5, extension tracking, share-based refund fields
-- =============================================
-- Pool 4
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool4_url VARCHAR(500);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool4_user VARCHAR(255);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool4_password VARCHAR(255);
-- Pool 5
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool5_url VARCHAR(500);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool5_user VARCHAR(255);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool5_password VARCHAR(255);

-- Extension tracking
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS original_duration_hours INTEGER;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS extended_hours INTEGER DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS extension_cost NUMERIC(18,8) DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS extensions_disabled BOOLEAN DEFAULT FALSE;

-- Share-based refund tracking
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS expected_shares BIGINT DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS actual_shares BIGINT DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS rejected_shares BIGINT DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(18,8) DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);

-- Pool status tracking
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS pool_status VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS rig_online BOOLEAN DEFAULT TRUE;

-- =============================================
-- 3. USER: Add auto withdrawal fields
-- =============================================
-- auto_payout_threshold already exists, add address-specific auto payout
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_rig_rented BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_rig_offline BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_rental_message BOOLEAN DEFAULT TRUE;

-- =============================================
-- 4. POOL PROFILES: Expand to 5-pool failover
-- =============================================
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool2_url VARCHAR(500);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool2_user VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool2_password VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool3_url VARCHAR(500);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool3_user VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool3_password VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool4_url VARCHAR(500);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool4_user VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool4_password VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool5_url VARCHAR(500);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool5_user VARCHAR(255);
ALTER TABLE pool_profiles ADD COLUMN IF NOT EXISTS pool5_password VARCHAR(255);

-- =============================================
-- 5. HASHRATE_LOGS: Add share tracking
-- =============================================
-- NOTE: Use shares_accepted/shares_rejected to match the Python model and init.sql
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_accepted BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_rejected BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_stale BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS difficulty DECIMAL(20,6) DEFAULT 1.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS share_rate DECIMAL(10,4) DEFAULT 0.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS rpi DECIMAL(6,2) DEFAULT 0.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pool_api';
-- If wrong column names were previously added, rename them
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hashrate_logs' AND column_name='accepted_shares') THEN
        ALTER TABLE hashrate_logs RENAME COLUMN accepted_shares TO shares_accepted;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hashrate_logs' AND column_name='rejected_shares') THEN
        ALTER TABLE hashrate_logs RENAME COLUMN rejected_shares TO shares_rejected;
    END IF;
END $$;

-- =============================================
-- 6. Create rental_extensions table
-- =============================================
CREATE TABLE IF NOT EXISTS rental_extensions (
    id SERIAL PRIMARY KEY,
    rental_id INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    hours INTEGER NOT NULL,
    price_per_hour NUMERIC(18,8) NOT NULL,
    total_cost NUMERIC(18,8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_extensions_rental_id ON rental_extensions(rental_id);

-- =============================================
-- 7. Add RPI to index for marketplace sorting
-- =============================================
CREATE INDEX IF NOT EXISTS idx_rigs_rpi_score ON rigs(rpi_score DESC);
CREATE INDEX IF NOT EXISTS idx_rigs_status_rpi ON rigs(status, rpi_score DESC);

-- =============================================
-- Done
-- =============================================

-- =============================================
-- 8. Backfill stratum info for existing rigs
-- =============================================
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS stratum_host VARCHAR(255);
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS stratum_port INTEGER;
UPDATE rigs SET stratum_host = 'stratum.hashbrotherhood.com', stratum_port = 3333 + id WHERE stratum_host IS NULL;

-- =============================================
-- 9. Support tickets tables
-- =============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    rental_id INTEGER REFERENCES rentals(id),
    assigned_to INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- =============================================
-- 10. Ensure escrow columns exist
-- =============================================
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS escrow_amount NUMERIC(18,8) DEFAULT 0;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS escrow_released BOOLEAN DEFAULT FALSE;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS rpi_at_start NUMERIC(6,2);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS proxy_port INTEGER;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS dispute_window_ends TIMESTAMP WITH TIME ZONE;

-- =============================================
-- 11. Prevent negative balance
-- =============================================
ALTER TABLE users ADD CONSTRAINT users_balance_non_negative CHECK (balance >= 0);
