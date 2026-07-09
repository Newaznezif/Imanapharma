-- ==============================================================================
-- 005_patients_prescriptions.sql
-- Description: Adds doctors, refill management, and expanded patient details.
-- ==============================================================================

-- Doctors Management
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(50),
    specialty VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Expand Prescriptions with doctor reference and refills
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills_authorized INT NOT NULL DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills_remaining INT NOT NULL DEFAULT 0;

-- Expand Patients with emergency details, insurance, and medical history
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;

-- Prescription Refills Log
CREATE TABLE IF NOT EXISTS prescription_refills_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    dispensed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doctors_license ON doctors(license_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
