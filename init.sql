-- HashBrotherHood Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    balance DECIMAL(18, 2) DEFAULT 0.00 CHECK (balance >= 0),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    bio TEXT,
    bsc_wallet_address VARCHAR(255),
    deposit_address VARCHAR(255) UNIQUE,
    deposit_hd_index INT,
    referral_code VARCHAR(20) UNIQUE,
    referred_by INT REFERENCES users(id),
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
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rigs
CREATE TABLE rigs (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    algorithm_id INT NOT NULL REFERENCES algorithms(id),
    hashrate DECIMAL(20, 4) NOT NULL CHECK (hashrate > 0),
    price_per_hour DECIMAL(18, 2) NOT NULL CHECK (price_per_hour > 0),
    min_rental_hours INT DEFAULT 2 CHECK (min_rental_hours >= 1),
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
    price_per_hour DECIMAL(18, 2) NOT NULL CHECK (price_per_hour > 0),
    duration_hours INT CHECK (duration_hours >= 1),
    total_cost DECIMAL(18, 2) NOT NULL CHECK (total_cost >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'expired')),
    pool_url VARCHAR(500),
    pool_user VARCHAR(255),
    pool_password VARCHAR(255) DEFAULT 'x',
    started_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'rental_payment', 'rental_earning', 'refund', 'fee')),
    amount DECIMAL(18, 2) NOT NULL,
    fee DECIMAL(18, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    tx_hash VARCHAR(255),
    wallet_address VARCHAR(255),
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint on tx_hash for deposit transactions to prevent race conditions
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

-- Admin Audit Logs (plural)
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

CREATE INDEX idx_disputes_rental ON disputes(rental_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_dispute_messages_dispute ON dispute_messages(dispute_id);

-- Favorites (watchlist)
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rig_id INT NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, rig_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- Messages (direct messaging between users)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);
CREATE INDEX idx_rigs_owner ON rigs(owner_id);
CREATE INDEX idx_rigs_algorithm ON rigs(algorithm_id);
CREATE INDEX idx_rigs_status ON rigs(status);
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

-- Seed default algorithms
INSERT INTO algorithms (name, display_name, unit) VALUES
    -- SHA-256 Family (Bitcoin, BCH, eCash, BSV)
    ('sha256', 'SHA-256', 'TH/s'),
    ('sha256asicboost', 'SHA-256 AsicBoost', 'TH/s'),
    ('sha256d', 'SHA-256d', 'TH/s'),
    ('sha256dt', 'SHA-256DT', 'TH/s'),
    ('sha512256d', 'SHA512/256d', 'TH/s'),
    -- SHA-3 / Keccak
    ('sha3', 'SHA-3', 'GH/s'),
    ('keccak', 'Keccak', 'GH/s'),
    -- Scrypt Family (Litecoin, Dogecoin, DigiByte)
    ('scrypt', 'Scrypt', 'GH/s'),
    ('scryptnf', 'ScryptNf', 'GH/s'),
    -- Ethash Family (Ethereum Classic, EthereumPoW)
    ('ethash', 'Ethash', 'MH/s'),
    ('etchash', 'Etchash', 'MH/s'),
    ('ubqhash', 'Ubqhash', 'MH/s'),
    ('ethashb3', 'EthashB3', 'MH/s'),
    -- Equihash Family (Zcash, Flux, Beam, Komodo, Pirate)
    ('equihash', 'Equihash', 'Sol/s'),
    ('equihash1254', 'Equihash 125,4', 'Sol/s'),
    ('equihash1445', 'Equihash 144,5', 'Sol/s'),
    ('equihash1505', 'Equihash 150,5', 'Sol/s'),
    ('equihash1927', 'Equihash 192,7', 'Sol/s'),
    ('equihash2109', 'Equihash 210,9', 'Sol/s'),
    ('zhash', 'ZHash', 'Sol/s'),
    ('zelhash', 'ZelHash', 'Sol/s'),
    ('beamhashiii', 'BeamHash III', 'Sol/s'),
    -- Blake Family (Decred, Siacoin, Kadena, Alephium)
    ('blake256r14', 'Blake256r14', 'GH/s'),
    ('blake2b', 'Blake2b', 'GH/s'),
    ('blake2bsia', 'Blake2b-Sia', 'GH/s'),
    ('blake2s', 'Blake2s', 'GH/s'),
    ('blake2skadena', 'Blake2s-Kadena', 'GH/s'),
    ('blake3', 'Blake3', 'GH/s'),
    ('blake3dcr', 'Blake3-Decred', 'GH/s'),
    -- KawPoW / ProgPoW Family (Ravencoin, Firo, Zano, Evrmore, Neurai)
    ('kawpow', 'KawPoW', 'MH/s'),
    ('progpow', 'ProgPoW', 'MH/s'),
    ('progpowz', 'ProgPowZ', 'MH/s'),
    ('evrprogpow', 'EvrProgPow', 'MH/s'),
    ('firopow', 'FiroPow', 'MH/s'),
    ('meowpow', 'MeowPow', 'MH/s'),
    -- Cuckoo Family (Grin, Cortex, Aeternity)
    ('cuckaroo29', 'Cuckaroo29', 'G/s'),
    ('cuckaroom29', 'Cuckaroom29', 'G/s'),
    ('cuckatoo31', 'Cuckatoo31', 'G/s'),
    ('cuckatoo32', 'Cuckatoo32', 'G/s'),
    ('cuckoocycle', 'Cuckoo Cycle', 'G/s'),
    ('cortex', 'Cortex', 'G/s'),
    -- RandomX Family (Monero, Wownero, Zephyr) - CPU
    ('randomx', 'RandomX', 'H/s'),
    ('randomsfx', 'RandomSFX', 'H/s'),
    ('randomwow', 'RandomWOW', 'H/s'),
    ('randomarq', 'RandomARQ', 'H/s'),
    -- CryptoNight Family (Conceal, Haven, legacy Monero)
    ('cryptonight', 'CryptoNight', 'H/s'),
    ('cryptonightv8', 'CryptoNightV8', 'H/s'),
    ('cryptonightr', 'CryptoNightR', 'H/s'),
    ('cryptonightheavy', 'CryptoNightHeavy', 'H/s'),
    ('cryptonightgpu', 'CryptoNightGPU', 'H/s'),
    ('cryptonighthaven', 'CryptoNightHaven', 'H/s'),
    ('cryptonightconceal', 'CryptoNightConceal', 'H/s'),
    -- X-Series Family (DASH, DigiByte, Verge)
    ('x11', 'X11', 'GH/s'),
    ('x11gost', 'X11Gost', 'GH/s'),
    ('x13', 'X13', 'GH/s'),
    ('x16r', 'X16R', 'MH/s'),
    ('x16rv2', 'X16Rv2', 'MH/s'),
    ('x16rt', 'X16RT', 'MH/s'),
    ('x16s', 'X16S', 'MH/s'),
    ('x17', 'X17', 'MH/s'),
    ('x21s', 'X21S', 'MH/s'),
    ('x25x', 'X25X', 'MH/s'),
    -- Lyra2 Family (Vertcoin legacy, Monacoin)
    ('lyra2rev2', 'Lyra2REv2', 'MH/s'),
    ('lyra2rev3', 'Lyra2REv3', 'MH/s'),
    ('lyra2z', 'Lyra2z', 'MH/s'),
    -- HeavyHash Family (Kaspa, Pyrin, Karlsen) - GPU/ASIC
    ('heavyhash', 'HeavyHash', 'GH/s'),
    ('kheavyhash', 'kHeavyHash', 'GH/s'),
    ('karlsenhash', 'KarlsenHash', 'GH/s'),
    -- Yescrypt / YesPower Family - CPU
    ('yescrypt', 'Yescrypt', 'KH/s'),
    ('yescryptr16', 'YescryptR16', 'KH/s'),
    ('yescryptr32', 'YescryptR32', 'KH/s'),
    ('yespower', 'YesPower', 'KH/s'),
    ('yespowersugar', 'YesPowerSUGAR', 'KH/s'),
    -- Argon2 Family (Nimiq, TurtleCoin) - CPU/GPU
    ('argon2d', 'Argon2d', 'KH/s'),
    ('argon2dnim', 'Argon2d-NIM', 'KH/s'),
    ('chukwa', 'Chukwa', 'KH/s'),
    -- GPU Specific (Vertcoin, Ergo, Iron Fish)
    ('verthash', 'Verthash', 'MH/s'),
    ('autolykos2', 'Autolykos2', 'MH/s'),
    ('fishhash', 'FishHash', 'MH/s'),
    -- Special Purpose / Newer (Nervos, Handshake, Nexa, Dynex, Xelis, Radiant, Aleo)
    ('octopus', 'Octopus', 'MH/s'),
    ('eaglesong', 'Eaglesong', 'GH/s'),
    ('handshake', 'Handshake', 'GH/s'),
    ('kadena', 'Kadena', 'GH/s'),
    ('nexapow', 'NexaPoW', 'MH/s'),
    ('dynexsolve', 'DynexSolve', 'MH/s'),
    ('xelishash', 'XelisHash', 'MH/s'),
    ('radiant', 'Radiant', 'GH/s'),
    ('zksnark', 'zkSNARK', 'H/s'),
    ('lbry', 'LBRY', 'GH/s'),
    ('sia', 'Sia', 'GH/s'),
    ('decred', 'Decred', 'GH/s'),
    ('odocrypt', 'Odocrypt', 'MH/s'),
    -- CPU Mining (Raptoreum, Dero)
    ('ghostrider', 'GhostRider', 'H/s'),
    ('astrobwtv2', 'AstroBWTv2', 'KH/s'),
    -- VerusHash / NeoScrypt / MTP
    ('verushash', 'VerusHash', 'MH/s'),
    ('neoscrypt', 'NeoScrypt', 'MH/s'),
    ('mtp', 'MTP', 'MH/s'),
    -- Multi-Algo / Misc
    ('groestl', 'Groestl', 'MH/s'),
    ('myrgroestl', 'Myr-Groestl', 'MH/s'),
    ('skein', 'Skein', 'GH/s'),
    ('qubit', 'Qubit', 'GH/s'),
    ('quark', 'Quark', 'GH/s'),
    ('nist5', 'NIST5', 'GH/s'),
    ('tribus', 'Tribus', 'GH/s'),
    ('c11', 'C11', 'GH/s'),
    ('phi2', 'PHI2', 'MH/s'),
    ('allium', 'Allium', 'MH/s'),
    ('timetravel', 'TimeTravel', 'MH/s'),
    ('xevan', 'Xevan', 'MH/s'),
    ('hmq1725', 'HMQ1725', 'MH/s'),
    ('skunk', 'Skunk', 'GH/s');

-- Seed default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
    ('platform_fee_percent', '3.0', 'Platform fee percentage on rentals'),
    ('min_deposit', '1', 'Minimum deposit amount in USDT'),
    ('min_withdrawal', '10', 'Minimum withdrawal amount in USDT'),
    ('withdrawal_fee', '1', 'Withdrawal fee in USDT'),
    ('max_rental_hours', '720', 'Maximum rental duration in hours'),
    ('maintenance_mode', 'false', 'Platform maintenance mode'),
    ('platform_wallet', '0x0000000000000000000000000000000000000000', 'Platform BSC wallet address for deposits');

-- Default admin user (password: Admin123! — CHANGE IN PRODUCTION!)
INSERT INTO users (email, username, password_hash, role, is_active, is_verified)
VALUES ('admin@hashbrotherhood.com', 'admin', '$2b$12$fs0yQtLaZz/8s9WxhoNL2OB5bFwX4seOOcmbjn4XkcYwln1OGDFdO', 'admin', true, true);
