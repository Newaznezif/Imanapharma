-- ==============================================================================
-- Migration 001: Enterprise Security Upgrade
-- Safe to run on existing ImanaPharma databases (idempotent)
-- Run: psql -d imanapharma -f migrations/001_enterprise_upgrade.sql
-- ==============================================================================

-- Auto-update trigger function (idempotent)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- users table: new security columns
-- ==============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_login_count   INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMPTZ;

-- Add check constraint on failed_login_count if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'users_failed_login_count_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_failed_login_count_check CHECK (failed_login_count >= 0);
  END IF;
END $$;

-- Update trigger for users
CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- users indexes
CREATE INDEX IF NOT EXISTS idx_users_username  ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- Mark existing non-manager seeded accounts as must change password
-- (only affects default seed accounts — real accounts already set individually)

-- ==============================================================================
-- medicines table: unique batch+manufacturer, indexes, trigger
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_medicines_batch_manufacturer'
  ) THEN
    ALTER TABLE medicines ADD CONSTRAINT uq_medicines_batch_manufacturer UNIQUE (batch_number, manufacturer);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_medicines_drug_name   ON medicines (drug_name);
CREATE INDEX IF NOT EXISTS idx_medicines_category    ON medicines (category);
CREATE INDEX IF NOT EXISTS idx_medicines_expiry_date ON medicines (expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_quantity    ON medicines (quantity);

-- ==============================================================================
-- patients table: add updated_at and phone
-- ==============================================================================
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS phone      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (name);

-- ==============================================================================
-- prescriptions table: CREATE if missing
-- ==============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id                           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_name                 VARCHAR(255) NOT NULL,
    doctor_name                  VARCHAR(255) NOT NULL,
    rx_number                    VARCHAR(100) NOT NULL UNIQUE,
    is_validated                 BOOLEAN      NOT NULL DEFAULT FALSE,
    validated_by_pharmacist_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    validated_at                 TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_rx_number    ON prescriptions (rx_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_name ON prescriptions (patient_name);

-- ==============================================================================
-- orders table: add doctor_name, CANCELLED status, updated_at, indexes
-- ==============================================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Extend status CHECK to include CANCELLED (drop old, add new)
DO $$
BEGIN
  -- Remove old constraint if it doesn't include CANCELLED
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.table_constraints tc ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name = 'orders' AND cc.constraint_name LIKE 'orders_status%'
    AND cc.check_clause NOT LIKE '%CANCELLED%'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED'));
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_patient_id    ON orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_pharmacist_id ON orders (pharmacist_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders (created_at DESC);

-- ==============================================================================
-- order_items: indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_medicine_id ON order_items (medicine_id);

-- ==============================================================================
-- audit_logs: migrate payload TEXT -> JSONB, add ip_address, indexes
-- ==============================================================================
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS ip_address INET;

-- Migrate payload from TEXT to JSONB (safe: existing data is already JSON strings)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'payload' AND data_type = 'text'
  ) THEN
    ALTER TABLE audit_logs ALTER COLUMN payload TYPE JSONB USING payload::jsonb;
  END IF;
END $$;

-- Set NOT NULL default for payload
ALTER TABLE audit_logs ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);

-- ==============================================================================
-- settings: add trigger
-- ==============================================================================
CREATE OR REPLACE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Done
SELECT 'Migration 001 applied successfully' AS result;
