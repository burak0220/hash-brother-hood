-- Cancellation Request System
-- Users can request cancellation, admin approves/rejects based on hashrate

CREATE TABLE cancellation_requests (
    id SERIAL PRIMARY KEY,
    rental_id INT NOT NULL UNIQUE REFERENCES rentals(id) ON DELETE RESTRICT,
    requester_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_by INT REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cancellation_requests_status ON cancellation_requests(status);
CREATE INDEX idx_cancellation_requests_rental ON cancellation_requests(rental_id);

-- Hashrate logging table (already created in previous migration)
-- CREATE TABLE hashrate_logs (...)

COMMENT ON TABLE cancellation_requests IS 'Rental cancellation requests requiring admin approval';
COMMENT ON COLUMN cancellation_requests.reason IS 'low_hashrate, rig_offline, other';
COMMENT ON COLUMN cancellation_requests.status IS 'pending (awaiting review), approved (refund processed), rejected (denied)';
