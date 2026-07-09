-- ==============================================================================
-- 007_controlled_substances.sql
-- Description: Adds controlled substance verification fields and flags.
-- ==============================================================================

-- Add classification category flags or controlled substance bool to medicines table
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS is_controlled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add prescriber license number and double-check approval flags to order log
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescriber_license VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS double_checked_by UUID REFERENCES users(id) ON DELETE SET NULL;
