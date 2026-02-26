-- MRR Feature Parity: Add optimal difficulty range, device count, and extension control
-- Run on existing DB: docker exec <postgres_container> psql -U postgres -d hashbrotherhoood

ALTER TABLE rigs
  ADD COLUMN IF NOT EXISTS optimal_diff_min BIGINT,
  ADD COLUMN IF NOT EXISTS optimal_diff_max BIGINT,
  ADD COLUMN IF NOT EXISTS ndevices INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extensions_enabled BOOLEAN NOT NULL DEFAULT TRUE;
