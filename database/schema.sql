-- ==============================================================================
-- ImanaPharma Enterprise Database Schema
-- PostgreSQL — Production Ready
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- Auto-update updated_at trigger function
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 1. Pharmacy Settings (singleton row, id always = 1)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name        VARCHAR(255) NOT NULL DEFAULT 'Imana Pharmacy',
    address     VARCHAR(255) NOT NULL DEFAULT 'Central Business District, HQ',
    phone       VARCHAR(50)  NOT NULL DEFAULT '+251 11 123 4567',
    email       VARCHAR(100) NOT NULL DEFAULT 'info@imanapharma.com',
    logo_url    VARCHAR(255) NOT NULL DEFAULT '/uploads/logo.png',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ==============================================================================
-- 2. Users
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    username              VARCHAR(100) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    role                  VARCHAR(50)  NOT NULL CHECK (role IN ('MANAGER', 'PHARMACIST', 'CASHIER')),
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    must_change_password  BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_count    INT          NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_username  ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- ==============================================================================
-- 3. Medicines (Inventory)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS medicines (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    drug_name     VARCHAR(255) NOT NULL,
    category      VARCHAR(50)  NOT NULL CHECK (category IN ('Rx', 'OTC')),
    strength      VARCHAR(100) NOT NULL,
    price         DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    quantity      INT          NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    expiry_date   DATE         NOT NULL,
    manufacturer  VARCHAR(255) NOT NULL,
    batch_number  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate batch from same manufacturer
    UNIQUE (batch_number, manufacturer)
);

CREATE OR REPLACE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_medicines_drug_name    ON medicines (drug_name);
CREATE INDEX IF NOT EXISTS idx_medicines_category     ON medicines (category);
CREATE INDEX IF NOT EXISTS idx_medicines_expiry_date  ON medicines (expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_quantity     ON medicines (quantity);

-- ==============================================================================
-- 4. Patients
-- ==============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(255) NOT NULL,
    phone          VARCHAR(50),
    allergy_flags  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (name);

-- ==============================================================================
-- 5. Prescriptions
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
-- 6. Orders (Sales lifecycle)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number    SERIAL        UNIQUE,
    patient_name    VARCHAR(255)  NOT NULL,
    patient_id      UUID          REFERENCES patients(id) ON DELETE SET NULL,
    rx_number       VARCHAR(100),
    doctor_name     VARCHAR(255),
    total_amount    DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    payment_method  VARCHAR(50)   CHECK (payment_method IN ('CASH', 'CARD', 'MOBILE_MONEY')),
    status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    pharmacist_id   UUID          REFERENCES users(id) ON DELETE SET NULL,
    cashier_id      UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_patient_id   ON orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_pharmacist_id ON orders (pharmacist_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders (created_at DESC);

-- ==============================================================================
-- 7. Order Items
-- ==============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id  UUID          REFERENCES medicines(id) ON DELETE SET NULL,
    drug_name    VARCHAR(255)  NOT NULL,
    quantity     INT           NOT NULL CHECK (quantity > 0),
    price        DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    total_price  DECIMAL(12,2) NOT NULL CHECK (total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_medicine_id ON order_items (medicine_id);

-- ==============================================================================
-- 8. Audit Logs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    action_type  VARCHAR(100) NOT NULL,
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ip_address   INET,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);
