export type UserRole = 'ADMIN' | 'BRANCH_MANAGER' | 'PHARMACIST' | 'CASHIER';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  branch_id: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: 'Rx' | 'OTC';
  description?: string;
  created_at: string;
}

export type StockMovementType = 
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity_change: number; // Positive for IN/TRANSFER_IN/ADJUSTMENT, negative for OUT/TRANSFER_OUT/ADJUSTMENT
  type: StockMovementType;
  user_id: string;
  reference_id: string; // Sale item UUID, Transfer UUID, or sync transaction UUID
  created_at: string;
}

export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: 'CASH' | 'DIGITAL';
  is_offline: boolean;
  status: 'PENDING' | 'COMPLETED' | 'SYNCED';
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Prescription {
  id: string;
  patient_name: string;
  doctor_name: string;
  rx_number: string;
  is_validated: boolean;
  validated_by_pharmacist_id?: string;
  validated_at?: string;
  created_at: string;
}

export interface Patient {
  id: string;
  name: string;
  allergy_flags: string[]; // List of drug categories or SKUs they are allergic to
  created_at: string;
}

export type TransferStatus = 
  | 'REQUESTED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Transfer {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: TransferStatus;
  requested_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  requested_qty: number;
  shipped_qty: number;
  received_qty: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  timestamp: string;
  branch_id: string;
  payload_snapshot: string; // JSON string representation
  before_state?: string; // JSON string representation
  after_state?: string; // JSON string representation
}

export interface SyncEvent {
  event_uuid: string;
  branch_id: string;
  sequence_number: number;
  schema_version: string;
  entity_type: 'SALE' | 'STOCK_MOVEMENT' | 'TRANSFER' | 'AUDIT_LOG' | 'SHIFT_RECONCILIATION';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retry_count: number;
  last_retry_timestamp?: string;
  failure_reason?: string;
  created_at: string;
}

export interface Shift {
  id: string;
  branch_id: string;
  user_id: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  expected_closing_cash?: number;
  physical_closing_cash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
}
