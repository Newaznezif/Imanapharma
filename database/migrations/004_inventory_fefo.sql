-- ==============================================================================
-- 004_inventory_fefo.sql
-- Description: Adds barcode support, stock adjustments, reconciliation tables.
-- ==============================================================================

-- Add barcode and QR fields to medicines
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS min_reorder_level INT NOT NULL DEFAULT 10;

-- Stock Adjustments (for Damaged, Expired, Reconciliation, etc.)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity_adjusted INT NOT NULL, -- negative for deduction, positive for addition
    reason VARCHAR(100) NOT NULL CHECK (reason IN ('DAMAGED', 'EXPIRED', 'THEFT', 'RECONCILIATION', 'MANUAL_ADDITION', 'STOCK_TRANSFER')),
    notes TEXT,
    adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stock Reconciliation sessions
CREATE TABLE IF NOT EXISTS inventory_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciled_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id UUID NOT NULL REFERENCES inventory_reconciliations(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    recorded_qty INT NOT NULL,
    actual_qty INT NOT NULL,
    discrepancy INT GENERATED ALWAYS AS (actual_qty - recorded_qty) STORED,
    reason TEXT
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_med ON stock_adjustments(medicine_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items ON inventory_reconciliation_items(reconciliation_id);
