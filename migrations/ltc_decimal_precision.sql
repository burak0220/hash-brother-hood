-- Migration: Fix decimal precision for LTC amounts
-- LTC supports 8 decimal places (litoshis); DECIMAL(18,2) is insufficient.
-- Run this if you applied previous migrations before this fix.

ALTER TABLE users
    ALTER COLUMN balance TYPE DECIMAL(18,8) USING balance::DECIMAL(18,8),
    ALTER COLUMN auto_payout_threshold TYPE DECIMAL(18,8) USING auto_payout_threshold::DECIMAL(18,8);

ALTER TABLE rigs
    ALTER COLUMN price_per_hour TYPE DECIMAL(18,8) USING price_per_hour::DECIMAL(18,8);

ALTER TABLE rentals
    ALTER COLUMN price_per_hour TYPE DECIMAL(18,8) USING price_per_hour::DECIMAL(18,8),
    ALTER COLUMN total_cost TYPE DECIMAL(18,8) USING total_cost::DECIMAL(18,8),
    ALTER COLUMN escrow_amount TYPE DECIMAL(18,8) USING escrow_amount::DECIMAL(18,8),
    ALTER COLUMN extension_cost TYPE DECIMAL(18,8) USING extension_cost::DECIMAL(18,8),
    ALTER COLUMN refund_amount TYPE DECIMAL(18,8) USING refund_amount::DECIMAL(18,8);

ALTER TABLE transactions
    ALTER COLUMN amount TYPE DECIMAL(18,8) USING amount::DECIMAL(18,8),
    ALTER COLUMN fee TYPE DECIMAL(18,8) USING fee::DECIMAL(18,8);

ALTER TABLE rental_extensions
    ALTER COLUMN price_per_hour TYPE DECIMAL(18,8) USING price_per_hour::DECIMAL(18,8),
    ALTER COLUMN total_cost TYPE DECIMAL(18,8) USING total_cost::DECIMAL(18,8);
