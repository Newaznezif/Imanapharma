import { Response } from 'express';
import { query, transaction } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';

export class SupplierController {
  // ── Suppliers ─────────────────────────────────────────────────────────────

  public static async getSuppliers(req: AuthenticatedRequest, res: Response) {
    try {
      const suppliers = await query('SELECT * FROM suppliers ORDER BY created_at DESC');
      return res.status(200).json(suppliers);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  public static async createSupplier(req: AuthenticatedRequest, res: Response) {
    const { name, contact_name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Supplier name is required' });

    try {
      const result = await query(
        `INSERT INTO suppliers (name, contact_name, phone, email, address) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, contact_name, phone, email, address]
      );
      return res.status(201).json(result[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Supplier with this name already exists' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────

  public static async getPurchaseOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const sql = `
        SELECT po.*, s.name as supplier_name, u1.username as ordered_by_name, u2.username as received_by_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u1 ON po.ordered_by = u1.id
        LEFT JOIN users u2 ON po.received_by = u2.id
        ORDER BY po.created_at DESC
      `;
      const rows = await query(sql);

      // Fetch items for all POs
      const itemsResult = await query(`
        SELECT poi.*, m.drug_name 
        FROM purchase_order_items poi 
        JOIN medicines m ON poi.medicine_id = m.id
      `);

      const orders = rows.map((po: any) => ({
        ...po,
        items: itemsResult.filter((it: any) => it.po_id === po.id)
      }));

      return res.status(200).json(orders);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  public static async createPurchaseOrder(req: AuthenticatedRequest, res: Response) {
    const { supplier_id, items } = req.body;
    const userId = req.user?.id;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Supplier and items are required' });
    }

    try {
      const poNumber = 'PO-' + Math.floor(100000 + Math.random() * 900000);
      let totalAmount = 0;

      const orderResult = await transaction(async (client) => {
        // Calculate total and ensure all meds exist
        for (const item of items) {
          totalAmount += item.quantity * item.unit_cost;
        }

        const poRow = await client.query(
          `INSERT INTO purchase_orders (supplier_id, po_number, total_amount, ordered_by) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [supplier_id, poNumber, totalAmount, userId]
        );
        const po = poRow.rows[0];

        for (const item of items) {
          await client.query(
            `INSERT INTO purchase_order_items (po_id, medicine_id, quantity, unit_cost) 
             VALUES ($1, $2, $3, $4)`,
            [po.id, item.medicine_id, item.quantity, item.unit_cost]
          );
        }
        return po;
      });

      return res.status(201).json(orderResult);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  public static async receivePurchaseOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    try {
      const result = await transaction(async (client) => {
        // Lock the PO row
        const poRows = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
        if (poRows.rows.length === 0) throw new Error('Purchase Order not found');
        const po = poRows.rows[0];

        if (po.status !== 'PENDING') throw new Error('Order is already processed');

        // Fetch items
        const itemsRows = await client.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [id]);

        // Update medicine stock
        for (const item of itemsRows.rows) {
          await client.query(
            'UPDATE medicines SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [item.quantity, item.medicine_id]
          );
        }

        // Mark PO as received
        const updatedPo = await client.query(
          `UPDATE purchase_orders 
           SET status = 'RECEIVED', received_by = $1, received_at = CURRENT_TIMESTAMP 
           WHERE id = $2 RETURNING *`,
          [userId, id]
        );

        return updatedPo.rows[0];
      });

      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [userId, 'RECEIVE_PO', JSON.stringify({ poId: id }), req.ip]
      );

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
    }
  }
}
