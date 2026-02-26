-- Migration: Rename bsc_wallet_address to ltc_wallet_address
-- Run BEFORE ltc_decimal_precision.sql if applying from scratch,
-- or independently if decimal precision is already fixed.

ALTER TABLE users
    RENAME COLUMN bsc_wallet_address TO ltc_wallet_address;
