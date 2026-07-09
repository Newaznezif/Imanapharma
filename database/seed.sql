-- ==============================================================================
-- ImanaPharma Seed Data — Enterprise Edition
-- SECURITY: No plaintext passwords are stored or referenced anywhere in this file.
-- All password hashes were generated offline using bcrypt (cost factor 12).
-- ==============================================================================

-- 1. Pharmacy Settings
INSERT INTO settings (id, name, address, phone, email, logo_url) VALUES
(1, 'Imana Pharmacy', 'Bole Sub-City, Kebele 03, House No. 492, Addis Ababa, Ethiopia',
 '+251 11 661 2345', 'contact@imanapharma.com', '/uploads/logo.png')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Users
-- Admin: must_change_password=false (system administrator sets own password at deployment)
-- Staff: must_change_password=true  (must change on first login)
-- Hash below = bcrypt(cost=12) of the initial deployment password.
-- IMPORTANT: Change all passwords immediately after first login.
-- The initial password is documented ONLY in the secure deployment runbook —
-- it must NEVER appear in source code, logs, or documentation.
INSERT INTO users (id, username, password_hash, role, is_active, must_change_password) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgfl92nJoTNsHhzFGJvDim',
 'MANAGER', true, false),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pharmacist',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgfl92nJoTNsHhzFGJvDim',
 'PHARMACIST', true, true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgfl92nJoTNsHhzFGJvDim',
 'CASHIER', true, true)
ON CONFLICT (username) DO NOTHING;

-- 3. Seed Medicines
INSERT INTO medicines (id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number) VALUES
('d1111111-1111-1111-1111-111111111111', 'Warfarin',     'Rx',  '5mg',   12.50, 150, '2028-12-31', 'AstraZeneca', 'B-WARF-01'),
('d2222222-2222-2222-2222-222222222222', 'Aspirin',      'OTC', '81mg',   4.20, 500, '2027-06-30', 'Bayer',       'B-ASPI-01'),
('d3333333-3333-3333-3333-333333333333', 'Erythromycin', 'Rx',  '250mg', 18.00,  80, '2027-10-31', 'Pfizer',      'B-ERYT-01'),
('d4444444-4444-4444-4444-444444444444', 'Simvastatin',  'Rx',  '20mg',  15.00, 200, '2027-08-31', 'Merck',       'B-SIMV-01'),
('d5555555-5555-5555-5555-555555555555', 'Atorvastatin', 'Rx',  '10mg',  22.10, 120, '2028-01-31', 'Pfizer',      'B-ATOR-01'),
('d6666666-6666-6666-6666-666666666666', 'Ibuprofen',    'OTC', '200mg',  5.50, 400, '2027-04-30', 'GSK',         'B-IBUP-01')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Patients
INSERT INTO patients (id, name, allergy_flags) VALUES
('e1111111-1111-1111-1111-111111111111', 'John Doe',   '["IBUPROFEN"]'::jsonb),
('e2222222-2222-2222-2222-222222222222', 'Jane Smith', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
