-- Migration: Pool Profiles + Rental Updates + User Updates
-- Run this against the hashrent database

-- 1. Add pool_profiles table
CREATE TABLE IF NOT EXISTS pool_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    algorithm_id INT REFERENCES algorithms(id),
    pool_url VARCHAR(500) NOT NULL,
    pool_user VARCHAR(255) NOT NULL,
    pool_password VARCHAR(255) DEFAULT 'x',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pool_profiles_user ON pool_profiles(user_id);

-- 2. Add rental_messages table
CREATE TABLE IF NOT EXISTS rental_messages (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rental_messages_rental ON rental_messages(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_messages_sender ON rental_messages(sender_id);

-- 3. Add backup pool columns to rentals
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS pool2_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS pool2_user VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pool2_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pool3_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS pool3_user VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pool3_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS actual_hashrate_avg DECIMAL(20, 4),
    ADD COLUMN IF NOT EXISTS performance_percent DECIMAL(6, 2),
    ADD COLUMN IF NOT EXISTS dispute_window_ends TIMESTAMP WITH TIME ZONE;

-- 4. Add user columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auto_payout_threshold DECIMAL(18, 8) DEFAULT 0.00000000,
    ADD COLUMN IF NOT EXISTS security_hold_until TIMESTAMP WITH TIME ZONE;
