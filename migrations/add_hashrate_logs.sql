-- Add hashrate logging table for monitoring rig performance
CREATE TABLE hashrate_logs (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    measured_hashrate DECIMAL(20, 4) NOT NULL,
    advertised_hashrate DECIMAL(20, 4) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    source VARCHAR(50) DEFAULT 'pool_api',
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_hashrate_rental ON hashrate_logs(rental_id);
CREATE INDEX idx_hashrate_measured_at ON hashrate_logs(measured_at);

-- Add hashrate_logs relationship to rentals (handled by SQLAlchemy)
-- No schema change needed for rentals table
