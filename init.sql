-- HashBrotherHood Database Schema (complete, authoritative)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    balance DECIMAL(18, 8) DEFAULT 0.00000000 CHECK (balance >= 0),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    bio TEXT,
    ltc_wallet_address VARCHAR(255),
    deposit_address VARCHAR(255) UNIQUE,
    deposit_hd_index INT,
    referral_code VARCHAR(20) UNIQUE,
    referred_by INT REFERENCES users(id),
    auto_payout_threshold DECIMAL(18, 8) DEFAULT 0.00000000,
    security_hold_until TIMESTAMP WITH TIME ZONE,
    notification_rig_rented BOOLEAN DEFAULT true,
    notification_rig_offline BOOLEAN DEFAULT true,
    notification_rental_message BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Algorithms
CREATE TABLE algorithms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'TH/s',
    description TEXT,
    coins VARCHAR(500),
    diff_suggested BIGINT,
    diff_min BIGINT,
    diff_max BIGINT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rigs
CREATE TABLE rigs (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    algorithm_id INT NOT NULL REFERENCES algorithms(id),
    hashrate DECIMAL(20, 4) NOT NULL CHECK (hashrate > 0),
    price_per_hour DECIMAL(18, 8) NOT NULL CHECK (price_per_hour > 0),
    min_rental_hours INT DEFAULT 1 CHECK (min_rental_hours >= 1),
    max_rental_hours INT DEFAULT 720 CHECK (max_rental_hours >= 1),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'rented', 'maintenance')),
    region VARCHAR(50) DEFAULT 'auto',
    uptime_percentage DECIMAL(5, 2) DEFAULT 99.00,
    total_rentals INT DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 0.00,
    stratum_host VARCHAR(255),
    stratum_port INT,
    worker_prefix VARCHAR(100),
    is_featured BOOLEAN DEFAULT false,
    -- MRR Feature Parity
    rpi_score NUMERIC(6, 2) DEFAULT 100.00,
    suggested_difficulty VARCHAR(100),
    auto_price_enabled BOOLEAN DEFAULT false,
    auto_price_margin NUMERIC(5, 2) DEFAULT 0.00,
    owner_pool_url VARCHAR(500),
    owner_pool_user VARCHAR(255),
    owner_pool_password VARCHAR(255) DEFAULT 'x',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rentals
CREATE TABLE rentals (
    id SERIAL PRIMARY KEY,
    rig_id INT NOT NULL REFERENCES rigs(id) ON DELETE RESTRICT,
    renter_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    algorithm_id INT NOT NULL REFERENCES algorithms(id),
    hashrate DECIMAL(20, 4) NOT NULL CHECK (hashrate > 0),
    price_per_hour DECIMAL(18, 8) NOT NULL CHECK (price_per_hour > 0),
    duration_hours INT CHECK (duration_hours >= 1),
    total_cost DECIMAL(18, 8) NOT NULL CHECK (total_cost >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    -- Escrow
    escrow_amount DECIMAL(18, 8) DEFAULT 0,
    escrow_released BOOLEAN DEFAULT false,
    escrow_released_at TIMESTAMP WITH TIME ZONE,
    -- Dispute window (12h after completion)
    dispute_window_ends TIMESTAMP WITH TIME ZONE,
    -- Auto-cancel tracking
    low_hashrate_since TIMESTAMP WITH TIME ZONE,
    auto_cancelled BOOLEAN DEFAULT false,
    -- RPI snapshot at rental start
    rpi_at_start NUMERIC(6, 2),
    -- Primary pool
    pool_url VARCHAR(500),
    pool_user VARCHAR(255),
    pool_password VARCHAR(255) DEFAULT 'x',
    -- Backup pool 2
    pool2_url VARCHAR(500),
    pool2_user VARCHAR(255),
    pool2_password VARCHAR(255),
    -- Backup pool 3
    pool3_url VARCHAR(500),
    pool3_user VARCHAR(255),
    pool3_password VARCHAR(255),
    -- Backup pool 4
    pool4_url VARCHAR(500),
    pool4_user VARCHAR(255),
    pool4_password VARCHAR(255),
    -- Backup pool 5
    pool5_url VARCHAR(500),
    pool5_user VARCHAR(255),
    pool5_password VARCHAR(255),
    -- Extension tracking
    original_duration_hours INT,
    extended_hours INT DEFAULT 0,
    extension_cost DECIMAL(18, 8) DEFAULT 0,
    extensions_disabled BOOLEAN DEFAULT false,
    -- Share-based refund tracking
    expected_shares BIGINT DEFAULT 0,
    actual_shares BIGINT DEFAULT 0,
    rejected_shares BIGINT DEFAULT 0,
    refund_amount DECIMAL(18, 8) DEFAULT 0,
    refund_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by INT REFERENCES users(id),
    -- Pool & rig status
    pool_status VARCHAR(20) DEFAULT 'unknown',
    rig_online BOOLEAN DEFAULT true,
    -- Performance tracking (filled at completion)
    actual_hashrate_avg DECIMAL(20, 4),
    performance_percent DECIMAL(6, 2),
    -- Stratum proxy port
    proxy_port INT,
    started_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (no CHECK on type — new types added over time)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(30) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    fee DECIMAL(18, 8) DEFAULT 0.00000000,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    tx_hash VARCHAR(255),
    wallet_address VARCHAR(255),
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to prevent duplicate deposit confirmations
CREATE UNIQUE INDEX idx_transactions_tx_hash_deposit ON transactions(tx_hash) WHERE tx_hash IS NOT NULL AND type = 'deposit' AND status IN ('completed', 'pending');

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE RESTRICT,
    rig_id INT NOT NULL REFERENCES rigs(id) ON DELETE RESTRICT,
    reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Settings
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin Audit Logs
CREATE TABLE admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disputes
CREATE TABLE disputes (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE RESTRICT,
    opened_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    resolution TEXT,
    resolved_by INT REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dispute_messages (
    id SERIAL PRIMARY KEY,
    dispute_id INT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Favorites (watchlist)
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rig_id INT NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, rig_id)
);

-- Messages (direct messaging between users)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hashrate logs (actual hashrate measurements per rental)
CREATE TABLE hashrate_logs (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    measured_hashrate DECIMAL(20, 4) NOT NULL,
    advertised_hashrate DECIMAL(20, 4) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    shares_accepted BIGINT DEFAULT 0,
    shares_rejected BIGINT DEFAULT 0,
    shares_stale BIGINT DEFAULT 0,
    difficulty DECIMAL(20, 6) DEFAULT 1.0,
    share_rate DECIMAL(10, 4) DEFAULT 0.0,
    rpi DECIMAL(6, 2) DEFAULT 0.0,
    source VARCHAR(50) DEFAULT 'pool_api',
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pool profiles (saved pool configs with 5-pool failover)
CREATE TABLE pool_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    algorithm_id INT REFERENCES algorithms(id),
    pool_url VARCHAR(500) NOT NULL,
    pool_user VARCHAR(255) NOT NULL,
    pool_password VARCHAR(255) DEFAULT 'x',
    pool2_url VARCHAR(500),
    pool2_user VARCHAR(255),
    pool2_password VARCHAR(255),
    pool3_url VARCHAR(500),
    pool3_user VARCHAR(255),
    pool3_password VARCHAR(255),
    pool4_url VARCHAR(500),
    pool4_user VARCHAR(255),
    pool4_password VARCHAR(255),
    pool5_url VARCHAR(500),
    pool5_user VARCHAR(255),
    pool5_password VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rental messages (chat between renter and owner per rental)
CREATE TABLE rental_messages (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rental extensions (history of rental extensions)
CREATE TABLE rental_extensions (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    hours INT NOT NULL,
    price_per_hour DECIMAL(18, 8) NOT NULL,
    total_cost DECIMAL(18, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cancellation requests (renter requests early cancel, admin reviews)
CREATE TABLE cancellation_requests (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL UNIQUE REFERENCES rentals(id) ON DELETE RESTRICT,
    requester_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INT REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    rental_id INT REFERENCES rentals(id),
    assigned_to INT REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_rigs_owner ON rigs(owner_id);
CREATE INDEX idx_rigs_algorithm ON rigs(algorithm_id);
CREATE INDEX idx_rigs_status ON rigs(status);
CREATE INDEX idx_rigs_rpi_score ON rigs(rpi_score DESC);
CREATE INDEX idx_rigs_status_rpi ON rigs(status, rpi_score DESC);

CREATE INDEX idx_rentals_renter ON rentals(renter_id);
CREATE INDEX idx_rentals_owner ON rentals(owner_id);
CREATE INDEX idx_rentals_rig ON rentals(rig_id);
CREATE INDEX idx_rentals_status ON rentals(status);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE INDEX idx_reviews_rig ON reviews(rig_id);
CREATE INDEX idx_reviews_rental ON reviews(rental_id);

CREATE INDEX idx_admin_audit_admin ON admin_audit_logs(admin_id);

CREATE INDEX idx_disputes_rental ON disputes(rental_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_dispute_messages_dispute ON dispute_messages(dispute_id);

CREATE INDEX idx_favorites_user ON favorites(user_id);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

CREATE INDEX idx_hashrate_rental ON hashrate_logs(rental_id);
CREATE INDEX idx_hashrate_measured_at ON hashrate_logs(measured_at);

CREATE INDEX idx_pool_profiles_user ON pool_profiles(user_id);

CREATE INDEX idx_rental_messages_rental ON rental_messages(rental_id);
CREATE INDEX idx_rental_messages_sender ON rental_messages(sender_id);

CREATE INDEX idx_rental_extensions_rental_id ON rental_extensions(rental_id);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id);

-- ─── Seed Data ─────────────────────────────────────────────────────────────

INSERT INTO algorithms (name, display_name, unit, coins, diff_suggested, diff_min, diff_max) VALUES
    -- SHA-256 Family
    ('sha256', 'SHA-256', 'TH/s', 'Bitcoin, Bitcoin Cash, eCash', 65536, 1024, 4194304),
    ('sha256asicboost', 'SHA-256 AsicBoost', 'TH/s', 'Bitcoin (AsicBoost)', 65536, 1024, 4194304),
    ('sha256d', 'SHA-256d', 'TH/s', 'Bitcoin SV', 65536, 1024, 4194304),
    ('sha256dt', 'SHA-256DT', 'TH/s', NULL, 65536, 1024, 4194304),
    ('sha512256d', 'SHA512/256d', 'TH/s', NULL, 65536, 1024, 4194304),
    -- SHA-3 / Keccak
    ('sha3', 'SHA-3', 'GH/s', 'Maxcoin', 1024, 64, 131072),
    ('keccak', 'Keccak', 'GH/s', 'Creativecoin', 1024, 64, 131072),
    -- Scrypt Family
    ('scrypt', 'Scrypt', 'GH/s', 'Litecoin, Dogecoin', 1024, 64, 131072),
    ('scryptnf', 'ScryptNf', 'GH/s', 'Vertcoin (legacy)', 512, 64, 65536),
    -- Ethash Family
    ('ethash', 'Ethash', 'MH/s', 'Ethereum Classic, Callisto', 4000000000, 1000000000, 16000000000),
    ('etchash', 'Etchash', 'MH/s', 'Ethereum Classic', 4000000000, 1000000000, 16000000000),
    ('ubqhash', 'Ubqhash', 'MH/s', 'Ubiq', 1000000000, 500000000, 8000000000),
    ('ethashb3', 'EthashB3', 'MH/s', 'Various Ethash coins', 1000000000, 500000000, 8000000000),
    -- Equihash Family
    ('equihash', 'Equihash', 'Sol/s', 'Zcash, Komodo, Horizen', 512, 64, 16384),
    ('equihash1254', 'Equihash 125,4', 'Sol/s', 'BitcoinZ', 256, 32, 8192),
    ('equihash1445', 'Equihash 144,5', 'Sol/s', 'BitcoinGold, Zcash', 512, 64, 16384),
    ('equihash1505', 'Equihash 150,5', 'Sol/s', 'Flux, ZelCash', 64, 8, 2048),
    ('equihash1927', 'Equihash 192,7', 'Sol/s', 'Komodo', 256, 32, 8192),
    ('equihash2109', 'Equihash 210,9', 'Sol/s', 'Ycash', 128, 16, 4096),
    ('zhash', 'ZHash', 'Sol/s', 'BitcoinGold', 512, 64, 16384),
    ('zelhash', 'ZelHash', 'Sol/s', 'Flux, ZelCash', 64, 8, 2048),
    ('beamhashiii', 'BeamHash III', 'Sol/s', 'Beam', 8, 1, 256),
    -- Blake Family
    ('blake256r14', 'Blake256r14', 'GH/s', 'Decred', 262144, 32768, 8388608),
    ('blake2b', 'Blake2b', 'GH/s', 'Siacoin', 2000000000000, 500000000000, 50000000000000),
    ('blake2bsia', 'Blake2b-Sia', 'GH/s', 'Siacoin', 2000000000000, 500000000000, 50000000000000),
    ('blake2s', 'Blake2s', 'GH/s', 'Kadena', 1000000000, 100000000, 100000000000),
    ('blake2skadena', 'Blake2s-Kadena', 'GH/s', 'Kadena', 1000000000, 100000000, 100000000000),
    ('blake3', 'Blake3', 'GH/s', 'Alephium', 100000000, 10000000, 10000000000),
    ('blake3dcr', 'Blake3-Decred', 'GH/s', 'Decred', 100000000, 10000000, 10000000000),
    -- KawPoW / ProgPoW Family
    ('kawpow', 'KawPoW', 'MH/s', 'Ravencoin', 1000000, 100000, 100000000),
    ('progpow', 'ProgPoW', 'MH/s', 'Sero', 500000, 50000, 50000000),
    ('progpowz', 'ProgPowZ', 'MH/s', NULL, 500000, 50000, 50000000),
    ('evrprogpow', 'EvrProgPow', 'MH/s', 'Evrmore', 500000, 50000, 50000000),
    ('firopow', 'FiroPow', 'MH/s', 'Firo', 500000, 50000, 50000000),
    ('meowpow', 'MeowPow', 'MH/s', 'Meowcoin', 500000, 50000, 50000000),
    -- Cuckoo Family
    ('cuckaroo29', 'Cuckaroo29', 'G/s', 'Grin', 1, 1, 128),
    ('cuckaroom29', 'Cuckaroom29', 'G/s', 'Grin', 1, 1, 128),
    ('cuckatoo31', 'Cuckatoo31', 'G/s', 'Grin', 1, 1, 128),
    ('cuckatoo32', 'Cuckatoo32', 'G/s', 'Grin', 1, 1, 128),
    ('cuckoocycle', 'Cuckoo Cycle', 'G/s', 'Grin', 1, 1, 128),
    ('cortex', 'Cortex', 'G/s', 'Cortex', 1, 1, 64),
    -- RandomX Family (CPU)
    ('randomx', 'RandomX', 'H/s', 'Monero', 100000, 10000, 2000000),
    ('randomsfx', 'RandomSFX', 'H/s', 'Safex Cash', 50000, 5000, 1000000),
    ('randomwow', 'RandomWOW', 'H/s', 'Wownero', 50000, 5000, 1000000),
    ('randomarq', 'RandomARQ', 'H/s', 'ArQmA', 50000, 5000, 1000000),
    -- CryptoNight Family
    ('cryptonight', 'CryptoNight', 'H/s', 'Monero (legacy)', 50000, 5000, 1000000),
    ('cryptonightv8', 'CryptoNightV8', 'H/s', 'Monero', 50000, 5000, 1000000),
    ('cryptonightr', 'CryptoNightR', 'H/s', 'Monero', 50000, 5000, 1000000),
    ('cryptonightheavy', 'CryptoNightHeavy', 'H/s', 'Loki, Haven', 10000, 1000, 500000),
    ('cryptonightgpu', 'CryptoNightGPU', 'H/s', 'Ryo', 10000, 1000, 500000),
    ('cryptonighthaven', 'CryptoNightHaven', 'H/s', 'Haven Protocol', 10000, 1000, 500000),
    ('cryptonightconceal', 'CryptoNightConceal', 'H/s', 'Conceal', 10000, 1000, 500000),
    -- X-Series Family
    ('x11', 'X11', 'GH/s', 'Dash', 8192, 512, 524288),
    ('x11gost', 'X11Gost', 'GH/s', 'Sibcoin', 4096, 256, 262144),
    ('x13', 'X13', 'GH/s', NULL, 4096, 256, 262144),
    ('x16r', 'X16R', 'MH/s', 'Ravencoin (legacy)', 1000000, 100000, 100000000),
    ('x16rv2', 'X16Rv2', 'MH/s', 'Ravencoin', 1000000, 100000, 100000000),
    ('x16rt', 'X16RT', 'MH/s', 'Gincoin', 1000000, 100000, 100000000),
    ('x16s', 'X16S', 'MH/s', 'Pigeoncoin', 1000000, 100000, 100000000),
    ('x17', 'X17', 'MH/s', NULL, 1000000, 100000, 100000000),
    ('x21s', 'X21S', 'MH/s', NULL, 1000000, 100000, 100000000),
    ('x25x', 'X25X', 'MH/s', NULL, 1000000, 100000, 100000000),
    -- Lyra2 Family
    ('lyra2rev2', 'Lyra2REv2', 'MH/s', 'Vertcoin', 8192, 512, 524288),
    ('lyra2rev3', 'Lyra2REv3', 'MH/s', 'Vertcoin', 8192, 512, 524288),
    ('lyra2z', 'Lyra2z', 'MH/s', 'Zcoin (legacy)', 8192, 512, 524288),
    -- HeavyHash Family (Kaspa etc.)
    ('heavyhash', 'HeavyHash', 'GH/s', 'Kaspa', 1000000000, 100000000, 100000000000),
    ('kheavyhash', 'kHeavyHash', 'GH/s', 'Kaspa', 1000000000, 100000000, 100000000000),
    ('karlsenhash', 'KarlsenHash', 'GH/s', 'Karlsen', 1000000000, 100000000, 100000000000),
    -- Yescrypt / YesPower (CPU)
    ('yescrypt', 'Yescrypt', 'KH/s', 'YENTEN', 1000, 100, 100000),
    ('yescryptr16', 'YescryptR16', 'KH/s', NULL, 1000, 100, 100000),
    ('yescryptr32', 'YescryptR32', 'KH/s', NULL, 1000, 100, 100000),
    ('yespower', 'YesPower', 'KH/s', NULL, 1000, 100, 100000),
    ('yespowersugar', 'YesPowerSUGAR', 'KH/s', 'Sugarchain', 1000, 100, 100000),
    -- Argon2 Family (CPU/GPU)
    ('argon2d', 'Argon2d', 'KH/s', NULL, 10000, 1000, 500000),
    ('argon2dnim', 'Argon2d-NIM', 'KH/s', 'Nimiq', 10000, 1000, 500000),
    ('chukwa', 'Chukwa', 'KH/s', 'Turtlecoin', 10000, 1000, 500000),
    -- GPU Specific
    ('verthash', 'Verthash', 'MH/s', 'Vertcoin', 65536, 8192, 2097152),
    ('autolykos2', 'Autolykos2', 'MH/s', 'Ergo', 500000000, 100000000, 10000000000),
    ('fishhash', 'FishHash', 'MH/s', 'IronFish', 1000000000, 100000000, 100000000000),
    -- Special Purpose / Newer
    ('octopus', 'Octopus', 'MH/s', 'Conflux', 500000, 50000, 50000000),
    ('eaglesong', 'Eaglesong', 'GH/s', 'Nervos CKB', 1000000000, 100000000, 100000000000),
    ('handshake', 'Handshake', 'GH/s', 'Handshake HNS', 1000000000, 100000000, 100000000000),
    ('kadena', 'Kadena', 'GH/s', 'Kadena KDA', 1000000000, 100000000, 100000000000),
    ('nexapow', 'NexaPoW', 'MH/s', 'Nexa', 500000, 50000, 50000000),
    ('dynexsolve', 'DynexSolve', 'MH/s', 'Dynex', 500000, 50000, 50000000),
    ('xelishash', 'XelisHash', 'MH/s', 'Xelis', 500000, 50000, 50000000),
    ('radiant', 'Radiant', 'GH/s', 'Radiant RXD', 1000000000, 100000000, 100000000000),
    ('zksnark', 'zkSNARK', 'H/s', NULL, NULL, NULL, NULL),
    ('lbry', 'LBRY', 'GH/s', 'LBRY Credits', 1000000000, 100000000, 100000000000),
    ('sia', 'Sia', 'GH/s', 'Siacoin SC', 2000000000000, 500000000000, 50000000000000),
    ('decred', 'Decred', 'GH/s', 'Decred DCR', 262144, 32768, 8388608),
    ('odocrypt', 'Odocrypt', 'MH/s', 'DigiByte DGB', 1000000, 100000, 100000000),
    -- CPU Mining
    ('ghostrider', 'GhostRider', 'H/s', 'Raptoreum RTM', 100000, 10000, 2000000),
    ('astrobwtv2', 'AstroBWTv2', 'KH/s', 'Dero', 10000, 1000, 500000),
    -- VerusHash / NeoScrypt / MTP
    ('verushash', 'VerusHash', 'MH/s', 'Verus VRSC', 8192, 512, 524288),
    ('neoscrypt', 'NeoScrypt', 'MH/s', 'Feathercoin', 8192, 512, 524288),
    ('mtp', 'MTP', 'MH/s', 'Firo (legacy)', 500000, 50000, 50000000),
    -- Multi-Algo / Misc
    ('groestl', 'Groestl', 'MH/s', 'Groestlcoin GRS', 8192, 512, 524288),
    ('myrgroestl', 'Myr-Groestl', 'MH/s', 'DigiByte DGB', 8192, 512, 524288),
    ('skein', 'Skein', 'GH/s', 'DigiByte DGB', 1000000000, 100000000, 100000000000),
    ('qubit', 'Qubit', 'GH/s', 'DigiByte DGB', 1000000000, 100000000, 100000000000),
    ('quark', 'Quark', 'GH/s', NULL, 1000000000, 100000000, 100000000000),
    ('nist5', 'NIST5', 'GH/s', 'Talkcoin', 1000000000, 100000000, 100000000000),
    ('tribus', 'Tribus', 'GH/s', 'Denarius', 1000000000, 100000000, 100000000000),
    ('c11', 'C11', 'GH/s', 'Chaincoin', 1000000000, 100000000, 100000000000),
    ('phi2', 'PHI2', 'MH/s', 'Luxcoin', 1000000, 100000, 100000000),
    ('allium', 'Allium', 'MH/s', 'Garlic Coin', 1000000, 100000, 100000000),
    ('timetravel', 'TimeTravel', 'MH/s', NULL, 1000000, 100000, 100000000),
    ('xevan', 'Xevan', 'MH/s', NULL, 1000000, 100000, 100000000),
    ('hmq1725', 'HMQ1725', 'MH/s', 'Espers', 1000000, 100000, 100000000),
    ('skunk', 'Skunk', 'GH/s', 'Signatum', 1000000000, 100000000, 100000000000);

INSERT INTO platform_settings (key, value, description) VALUES
    ('platform_fee_percent', '3.0', 'Platform fee percentage on rentals'),
    ('min_deposit', '0.001', 'Minimum deposit amount in LTC'),
    ('min_withdrawal', '0.01', 'Minimum withdrawal amount in LTC'),
    ('withdrawal_fee', '0.0001', 'Withdrawal fee in LTC'),
    ('max_rental_hours', '720', 'Maximum rental duration in hours'),
    ('maintenance_mode', 'false', 'Platform maintenance mode'),
    ('platform_wallet', '', 'Platform LTC wallet address for deposits');

-- Default admin user (password: Admin123! — CHANGE IN PRODUCTION!)
INSERT INTO users (email, username, password_hash, role, is_active, is_verified)
VALUES ('admin@hashbrotherhood.com', 'admin', '$2b$12$jXXH4aZPRgOp0cLNGqv.4OlkeyHlwnesYUehmoCPzqzmRv3wKZ8WC', 'admin', true, true);
