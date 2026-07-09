import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../db/pool';

export class AdminController {
  /**
   * POST /api/v1/admin/backup
   * Restricted to: MANAGER
   * Initiates a JSON dump of all critical relational tables (auth, medicines, patients, orders, suppliers)
   * to ensure cross-platform compatibility and ease of restore without pg_dump dependencies.
   */
  public static async backupDatabase(req: AuthenticatedRequest, res: Response) {
    try {
      const [users, medicines, patients, orders, orderItems, suppliers, purchaseOrders, purchaseOrderItems] = await Promise.all([
        query('SELECT * FROM users'),
        query('SELECT * FROM medicines'),
        query('SELECT * FROM patients'),
        query('SELECT * FROM orders'),
        query('SELECT * FROM order_items'),
        query('SELECT * FROM suppliers'),
        query('SELECT * FROM purchase_orders'),
        query('SELECT * FROM purchase_order_items'),
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        users,
        medicines,
        patients,
        orders,
        orderItems,
        suppliers,
        purchaseOrders,
        purchaseOrderItems,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="imanapharma_backup_${Date.now()}.json"`);
      return res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'BACKUP_FAILED', message: err.message });
    }
  }

  /**
   * POST /api/v1/admin/restore
   * Restricted to: MANAGER
   * Restores relational states from an uploaded backup JSON payload.
   */
  public static async restoreDatabase(req: AuthenticatedRequest, res: Response) {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid backup file payload' });
    }

    try {
      const { users, medicines, patients, orders, orderItems, suppliers, purchaseOrders, purchaseOrderItems } = req.body;

      // Wrap in manual truncation and insert commands (nested transaction style)
      // Clean target tables in reverse dependency order
      await query('TRUNCATE purchase_order_items, purchase_orders, order_items, orders, medicines, patients, suppliers, users CASCADE');

      // 1. Users
      if (Array.isArray(users)) {
        for (const u of users) {
          await query(
            `INSERT INTO users (id, username, password_hash, role, is_active, must_change_password, locked_until, failed_attempts, password_changed_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [u.id, u.username, u.password_hash, u.role, u.is_active, u.must_change_password, u.locked_until, u.failed_attempts, u.password_changed_at]
          );
        }
      }

      // 2. Suppliers
      if (Array.isArray(suppliers)) {
        for (const s of suppliers) {
          await query(
            `INSERT INTO suppliers (id, name, contact_name, phone, email, address, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [s.id, s.name, s.contact_name, s.phone, s.email, s.address, s.is_active]
          );
        }
      }

      // 3. Patients
      if (Array.isArray(patients)) {
        for (const p of patients) {
          await query(
            `INSERT INTO patients (id, name, phone, allergy_flags, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number, medical_history) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [p.id, p.name, p.phone, p.allergy_flags, p.emergency_contact_name, p.emergency_contact_phone, p.insurance_provider, p.insurance_policy_number, p.medical_history]
          );
        }
      }

      // 4. Medicines
      if (Array.isArray(medicines)) {
        for (const m of medicines) {
          await query(
            `INSERT INTO medicines (id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [m.id, m.drug_name, m.category, m.strength, m.price, m.quantity, m.expiry_date, m.manufacturer, m.batch_number, m.barcode, m.min_reorder_level]
          );
        }
      }

      // 5. Orders
      if (Array.isArray(orders)) {
        for (const o of orders) {
          await query(
            `INSERT INTO orders (id, order_number, patient_name, total_amount, payment_method, status, pharmacist_id, discount_percent, tax_percent, rx_number, doctor_name) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [o.id, o.order_number, o.patient_name, o.total_amount, o.payment_method, o.status, o.pharmacist_id, o.discount_percent, o.tax_percent, o.rx_number, o.doctor_name]
          );
        }
      }

      // 6. Order items
      if (Array.isArray(orderItems)) {
        for (const oi of orderItems) {
          await query(
            `INSERT INTO order_items (id, order_id, medicine_id, drug_name, quantity, unit_price, total_price) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [oi.id, oi.order_id, oi.medicine_id, oi.drug_name, oi.quantity, oi.unit_price, oi.total_price]
          );
        }
      }

      // 7. Purchase Orders
      if (Array.isArray(purchaseOrders)) {
        for (const po of purchaseOrders) {
          await query(
            `INSERT INTO purchase_orders (id, supplier_id, po_number, total_amount, status, ordered_by, received_by, received_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [po.id, po.supplier_id, po.po_number, po.total_amount, po.status, po.ordered_by, po.received_by, po.received_at]
          );
        }
      }

      // 8. Purchase Order Items
      if (Array.isArray(purchaseOrderItems)) {
        for (const poi of purchaseOrderItems) {
          await query(
            `INSERT INTO purchase_order_items (id, po_id, medicine_id, quantity, unit_cost) 
             VALUES ($1, $2, $3, $4, $5)`,
            [poi.id, poi.po_id, poi.medicine_id, poi.quantity, poi.unit_cost]
          );
        }
      }

      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'RESTORE_DB', JSON.stringify({ timestamp: new Date().toISOString() }), req.ip]
      );

      return res.status(200).json({ success: true, message: 'Database state restored successfully' });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'RESTORE_FAILED', message: err.message });
    }
  }
}
