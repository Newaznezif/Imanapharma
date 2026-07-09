-- ==============================================================================
-- 006_pos_supplier_finance.sql
-- Description: Adds supplier invoices, returns, POS discounts, taxes, refunds, and daily cash summaries.
-- ==============================================================================

-- Expand orders with discount and tax columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 15.00; -- 15% Standard VAT in Ethiopia

-- POS Sales Returns
CREATE TABLE IF NOT EXISTS order_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    refund_amount DECIMAL(12,2) NOT NULL CHECK (refund_amount >= 0),
    reason TEXT NOT NULL,
    returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supplier Invoices & Accounts Payable
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount_due DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_due >= 0),
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supplier Returns (Purchase Returns)
CREATE TABLE IF NOT EXISTS supplier_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    return_number VARCHAR(100) UNIQUE NOT NULL,
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Daily Cash Drawer Sessions
CREATE TABLE IF NOT EXISTS daily_cash_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opening_cash DECIMAL(12,2) NOT NULL,
    closing_cash DECIMAL(12,2),
    actual_cash DECIMAL(12,2),
    discrepancy DECIMAL(12,2),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_returns ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_cash_summaries ON daily_cash_summaries(user_id);
