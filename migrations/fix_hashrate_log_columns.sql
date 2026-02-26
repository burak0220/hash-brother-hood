-- Fix Migration: Correct hashrate_logs column naming
-- Run this if sprint1_mrr_features.sql was already applied with wrong column names.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- Rename accepted_shares → shares_accepted if wrong name exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hashrate_logs' AND column_name='accepted_shares') THEN
        ALTER TABLE hashrate_logs RENAME COLUMN accepted_shares TO shares_accepted;
        RAISE NOTICE 'Renamed accepted_shares -> shares_accepted';
    END IF;
END $$;

-- Rename rejected_shares → shares_rejected if wrong name exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hashrate_logs' AND column_name='rejected_shares') THEN
        ALTER TABLE hashrate_logs RENAME COLUMN rejected_shares TO shares_rejected;
        RAISE NOTICE 'Renamed rejected_shares -> shares_rejected';
    END IF;
END $$;

-- Add missing columns if not present (from init.sql authoritative schema)
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_accepted BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_rejected BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS shares_stale BIGINT DEFAULT 0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS difficulty DECIMAL(20,6) DEFAULT 1.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS share_rate DECIMAL(10,4) DEFAULT 0.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS rpi DECIMAL(6,2) DEFAULT 0.0;
ALTER TABLE hashrate_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pool_api';

-- Drop incorrect pool_online / rig_online columns if they were added by old sprint1 migration
-- (These columns were mistakenly added; they don't exist in the authoritative schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hashrate_logs' AND column_name='pool_online') THEN
        ALTER TABLE hashrate_logs DROP COLUMN pool_online;
        RAISE NOTICE 'Dropped pool_online from hashrate_logs';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='hashrate_logs' AND column_name='rig_online') THEN
        ALTER TABLE hashrate_logs DROP COLUMN rig_online;
        RAISE NOTICE 'Dropped rig_online from hashrate_logs';
    END IF;
END $$;
