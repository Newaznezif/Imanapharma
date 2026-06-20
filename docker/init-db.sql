-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Roles
CREATE TABLE roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 3. Permissions
CREATE TABLE permissions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- 4. Role Permissions
CREATE TABLE role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) REFERENCES roles(id),
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Rx', 'OTC')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Stock Movements (Append-Only Ledger)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    branch_id UUID REFERENCES branches(id),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_change INT NOT NULL, -- Positive for stock in, negative for stock out
    type VARCHAR(50) NOT NULL CHECK (type IN ('STOCK_IN', 'STOCK_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT')),
    user_id UUID REFERENCES users(id),
    reference_id UUID NOT NULL, -- Ties movement to a specific Sale UUID, Transfer UUID, or adjust event UUID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create composite index on product_id + branch_id for stock aggregation
CREATE INDEX idx_stock_movements_prod_branch ON stock_movements(product_id, branch_id);
CREATE INDEX idx_stock_movements_batch_expiry ON stock_movements(batch_number, expiry_date);
CREATE INDEX idx_stock_movements_timestamp ON stock_movements(created_at);

-- 8. Sales
CREATE TABLE sales (
    id UUID PRIMARY KEY, -- Enforced UUID (generated at client / edge)
    branch_id UUID REFERENCES branches(id),
    user_id UUID REFERENCES users(id),
    total_amount DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'DIGITAL')),
    is_offline BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_timestamp ON sales(created_at);

-- 9. Sale Items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_number VARCHAR(100) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL
);

-- 10. Prescriptions
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    rx_number VARCHAR(100) UNIQUE NOT NULL,
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by_pharmacist_id UUID REFERENCES users(id),
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    allergy_flags JSONB DEFAULT '[]'::jsonb, -- Array of SKUs the patient is allergic to
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Transfers
CREATE TABLE transfers (
    id UUID PRIMARY KEY, -- Enforced UUID
    from_branch_id UUID REFERENCES branches(id),
    to_branch_id UUID REFERENCES branches(id),
    status VARCHAR(50) NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'DISPATCHED', 'COMPLETED', 'CANCELLED')),
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transfers_timestamp ON transfers(created_at);

-- 13. Transfer Items
CREATE TABLE transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID REFERENCES transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    requested_qty INT NOT NULL CHECK (requested_qty > 0),
    shipped_qty INT DEFAULT 0,
    received_qty INT DEFAULT 0
);

-- 14. Audit Logs (Immutable ledger)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    branch_id UUID REFERENCES branches(id),
    payload_snapshot TEXT NOT NULL,
    before_state TEXT,
    after_state TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 15. Processed Events (Cloud Sync Idempotency Table)
CREATE TABLE processed_events (
    event_uuid UUID PRIMARY KEY,
    branch_id UUID REFERENCES branches(id),
    sequence_number BIGINT NOT NULL,
    schema_version VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_branch_sequence UNIQUE (branch_id, sequence_number)
);

-- 16. Dead-Letter Queue (DLQ)
CREATE TABLE sync_dlq (
    event_uuid UUID PRIMARY KEY,
    branch_id UUID REFERENCES branches(id),
    sequence_number BIGINT,
    schema_version VARCHAR(50),
    entity_type VARCHAR(100),
    payload TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Request Idempotency Keys (For API Endpoints)
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    response_status INT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA

-- Roles
INSERT INTO roles (id, name, description) VALUES
('ADMIN', 'System Administrator', 'Has complete access to central analytics, user management, and configuration.'),
('BRANCH_MANAGER', 'Branch Manager', 'Manages branch inventory, shift reconciliations, and inter-branch requests.'),
('PHARMACIST', 'Pharmacist', 'Authorized to validate prescriptions and override clinical safety warnings.'),
('CASHIER', 'Point of Sale Cashier', 'Executes retail sales and reconciles shifts.');

-- Permissions
INSERT INTO permissions (id, name, description) VALUES
('ALL_ACCESS', 'Full Control', 'Unrestricted administrative access'),
('VIEW_ANALYTICS', 'View Global Analytics', 'View sales and stock stats across branches'),
('MANAGE_INVENTORY', 'Manage Inventory Batching', 'Manage stock movements and write adjustments'),
('RECONCILE_SHIFT', 'Close and Audit Shift Registers', 'Oversee cashier variances and shift closures'),
('APPROVE_TRANSFER', 'Approve Inter-Branch Requests', 'Authorize stock transfer requests'),
('VALIDATE_RX', 'Validate Prescriptions', 'Authorize Rx category medication checkouts'),
('EXECUTE_SALE', 'Process Customer Sales', 'Run the POS system checkout UI');

-- Role Permissions Mapping
INSERT INTO role_permissions (role_id, permission_id) VALUES
('ADMIN', 'ALL_ACCESS'),
('ADMIN', 'VIEW_ANALYTICS'),
('ADMIN', 'MANAGE_INVENTORY'),
('ADMIN', 'APPROVE_TRANSFER'),
('BRANCH_MANAGER', 'VIEW_ANALYTICS'),
('BRANCH_MANAGER', 'MANAGE_INVENTORY'),
('BRANCH_MANAGER', 'RECONCILE_SHIFT'),
('BRANCH_MANAGER', 'APPROVE_TRANSFER'),
('BRANCH_MANAGER', 'EXECUTE_SALE'),
('PHARMACIST', 'MANAGE_INVENTORY'),
('PHARMACIST', 'VALIDATE_RX'),
('PHARMACIST', 'EXECUTE_SALE'),
('CASHIER', 'EXECUTE_SALE');

-- Branches (Deterministic UUIDs for seeding and compose setup)
INSERT INTO branches (id, name, location, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'HQ Main Pharmacy', 'Central Business District', true),
('22222222-2222-2222-2222-222222222222', 'North Branch Clinic', 'Suburban Mall North', true),
('33333333-3333-3333-3333-333333333333', 'South Branch Terminal', 'Coastal Transit Plaza', true);

-- Users (Password hash: bcrypt value for 'password123')
-- Bcrypt hash: $2a$10$wK1F5N8q.bU7H3mZ8gZ6x.x0fE/7.G6jV.aCqgT3Q/9yqUvq.N8mC (mock dummy bcrypt hash for simplicity)
INSERT INTO users (id, username, password_hash, role_id, branch_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'ADMIN', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pharmacist_north', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'PHARMACIST', '22222222-2222-2222-2222-222222222222'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier_north', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'CASHIER', '22222222-2222-2222-2222-222222222222');

-- Products
INSERT INTO products (id, sku, name, category, description) VALUES
('d1111111-1111-1111-1111-111111111111', 'WARF', 'Warfarin 5mg Tablets', 'Rx', 'Oral anticoagulant (blood thinner). Requires pharmacist prescription validation.'),
('d2222222-2222-2222-2222-222222222222', 'ASPIRIN', 'Aspirin 81mg Chewable', 'OTC', 'Low-dose acetylsalicylic acid for cardiac therapy. OTC.'),
('d3333333-3333-3333-3333-333333333333', 'ERYTHR', 'Erythromycin 250mg Tablets', 'Rx', 'Macrolide antibiotic. Rx.'),
('d4444444-4444-4444-4444-444444444444', 'SIMVA', 'Simvastatin 20mg Tablets', 'Rx', 'HMG-CoA reductase inhibitor (statin) for hypercholesterolemia. Rx.'),
('d5555555-5555-5555-5555-555555555555', 'ATORV', 'Atorvastatin 10mg Tablets', 'Rx', 'Statins for lipid reduction. Rx.'),
('d6666666-6666-6666-6666-666666666666', 'IBUPROFEN', 'Ibuprofen 200mg Tablets', 'OTC', 'Nonsteroidal anti-inflammatory drug (NSAID). OTC.');

-- Initial Stock Movement Seeds (Adding initial stock to HQ and North branches)
-- HQ Main Pharmacy has 500 units of everything
INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id) VALUES
(uuid_generate_v4(), 'd1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'B-WARF-01', '2028-12-31', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'B-ASPI-01', '2027-06-30', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'B-ERYT-01', '2027-10-31', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'B-SIMV-01', '2027-08-31', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'B-ATOR-01', '2028-01-31', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'B-IBUP-01', '2027-04-30', 500, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000');

-- North Branch has 100 units of everything
INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id) VALUES
(uuid_generate_v4(), 'd1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'B-WARF-02', '2028-12-31', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'B-ASPI-02', '2027-06-30', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'B-ERYT-02', '2027-10-31', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'B-SIMV-02', '2027-08-31', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'B-ATOR-02', '2028-01-31', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000'),
(uuid_generate_v4(), 'd6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'B-IBUP-02', '2027-04-30', 100, 'STOCK_IN', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000');

-- Patients
INSERT INTO patients (id, name, allergy_flags) VALUES
('e1111111-1111-1111-1111-111111111111', 'John Doe', '["IBUPROFEN"]'::jsonb),
('e2222222-2222-2222-2222-222222222222', 'Jane Smith', '[]'::jsonb);
