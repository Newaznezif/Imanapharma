import { Response } from 'express';
import { query, transaction } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sanitizeString } from '../middleware/validate';

export class OrderController {
  /**
   * GET /api/v1/orders
   * Returns all orders
   */
  public static async getOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const orders = await query(
        `SELECT o.id, o.order_number, o.patient_name, o.rx_number, o.doctor_name, o.total_amount, o.status, o.created_at,
                u.username as pharmacist_name
         FROM orders o
         LEFT JOIN users u ON o.pharmacist_id = u.id
         ORDER BY o.created_at DESC`
      );
      return res.status(200).json(orders);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/orders
   * Pharmacist: Creates a patient order
   */
  public static async createOrder(req: AuthenticatedRequest, res: Response) {
    const { patient_name, patient_id, rx_number, doctor_name, items, discount_percent, tax_percent } = req.body;
    const pharmacistId = req.user?.id;

    if (!patient_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Patient name and items are required' });
    }

    try {
      // 1. Fetch products to get prices, names, and check Rx requirements
      const medicineIds = items.map(it => it.medicine_id);
      const dbMedicines = await query(
        'SELECT id, drug_name, category, price, quantity FROM medicines WHERE id = ANY($1)',
        [medicineIds]
      );

      if (dbMedicines.length !== items.length) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Some selected medicines do not exist' });
      }

      // Check stock availability (soft check)
      let totalAmount = 0;
      let hasRx = false;
      const orderItemsToCreate: any[] = [];

      for (const item of items) {
        const med = dbMedicines.find(m => m.id === item.medicine_id);
        if (!med) continue;

        if (med.quantity < item.quantity) {
          return res.status(400).json({
            error: 'BAD_REQUEST',
            message: `Insufficient stock for ${med.drug_name}. Available: ${med.quantity}, Requested: ${item.quantity}`,
          });
        }

        const categoryUpper = med.category?.toUpperCase();
        if (categoryUpper === 'RX' || categoryUpper === 'PRESCRIPTION' || categoryUpper === 'CONTROLLED') {
          hasRx = true;
        }

        const itemTotal = Number(med.price) * item.quantity;
        totalAmount += itemTotal;

        orderItemsToCreate.push({
          medicine_id: med.id,
          drug_name: med.drug_name,
          quantity: item.quantity,
          price: Number(med.price),
          total_price: itemTotal,
        });
      }

      // 2. If Rx, verify prescription details
      if (hasRx && (!rx_number || !doctor_name)) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Prescription validation required: Cart contains Rx medications. Please supply Rx Number and Doctor Name.',
        });
      }

      // 3. Process inside transaction: Create order & order items, insert prescription validation if needed
      const orderResult = await transaction(async (client) => {
        // Insert prescription validation if Rx
        if (hasRx && rx_number && doctor_name) {
          const rxRes = await client.query(
            `INSERT INTO prescriptions (patient_name, doctor_name, rx_number, is_validated, validated_by_pharmacist_id, validated_at)
             VALUES ($1, $2, $3, true, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (rx_number) DO UPDATE SET is_validated = true, validated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [sanitizeString(patient_name), sanitizeString(doctor_name), sanitizeString(rx_number), pharmacistId]
          );
          const prescriptionId = rxRes.rows[0].id;

          // Insert prescription items for Rx medicines in this order
          for (const oItem of orderItemsToCreate) {
             const med = dbMedicines.find(m => m.id === oItem.medicine_id);
             const catUpper = med?.category?.toUpperCase();
             if (med && (catUpper === 'RX' || catUpper === 'PRESCRIPTION' || catUpper === 'CONTROLLED')) {
                await client.query(
                  `INSERT INTO prescription_items (prescription_id, medicine_id, quantity, dosage_instructions)
                   VALUES ($1, $2, $3, $4)`,
                  [prescriptionId, oItem.medicine_id, oItem.quantity, 'As directed by physician']
                );
             }
          }
        }

        const disc = discount_percent ? Number(discount_percent) : 0.00;
        const tax = tax_percent ? Number(tax_percent) : 15.00;
        const finalTotal = (totalAmount * (1 - disc / 100)) * (1 + tax / 100);

        // Insert Order
        const orderInsert = await client.query(
          `INSERT INTO orders (patient_name, patient_id, rx_number, doctor_name, total_amount, discount_percent, tax_percent, status, pharmacist_id, prescriber_license)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9)
           RETURNING *`,
          [
            sanitizeString(patient_name), 
            patient_id || null, 
            rx_number ? sanitizeString(rx_number) : null, 
            doctor_name ? sanitizeString(doctor_name) : null,
            finalTotal,
            disc,
            tax,
            pharmacistId,
            req.body.prescriber_license ? sanitizeString(req.body.prescriber_license) : null
          ]
        );
        const order = orderInsert.rows[0];

        // Insert Order Items
        for (const oItem of orderItemsToCreate) {
          await client.query(
            `INSERT INTO order_items (order_id, medicine_id, drug_name, quantity, price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, oItem.medicine_id, oItem.drug_name, oItem.quantity, oItem.price, oItem.total_price]
          );
        }

        return order;
      });

      // Audit Log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [pharmacistId, 'CREATE_ORDER', JSON.stringify({ orderId: orderResult.id, orderNumber: orderResult.order_number, totalAmount: orderResult.total_amount }), req.ip]
      );

      return res.status(201).json({
        message: 'Order sent to Cashier workspace',
        orderId: orderResult.id,
        orderNumber: orderResult.order_number,
        totalAmount: orderResult.total_amount,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/orders/pending
   * Returns all pending orders with their items
   */
  public static async getPendingOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const orders = await query(
        `SELECT o.id, o.order_number, o.patient_name, o.rx_number, o.doctor_name, o.total_amount, o.status, o.created_at,
                u.username as pharmacist_name
         FROM orders o
         LEFT JOIN users u ON o.pharmacist_id = u.id
         WHERE o.status = 'PENDING'
         ORDER BY o.created_at ASC`
      );

      const orderIds = orders.map(o => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        items = await query(
          `SELECT id, order_id, medicine_id, drug_name, quantity, price, total_price 
           FROM order_items 
           WHERE order_id = ANY($1)`,
          [orderIds]
        );
      }

      const ordersWithItems = orders.map(order => ({
        ...order,
        items: items.filter(item => item.order_id === order.id),
      }));

      return res.status(200).json(ordersWithItems);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/orders/:id/checkout
   * Cashier: Finalizes payment and deducts inventory quantities
   */
  public static async checkoutOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { payment_method } = req.body;
    const userId = req.user?.id;

    if (!payment_method || !['CASH', 'CARD', 'MOBILE_MONEY'].includes(payment_method)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid payment method is required' });
    }

    try {
      // 1. Fetch order and items
      const orderRows = await query('SELECT * FROM orders WHERE id = $1', [id]);
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      }

      const order = orderRows[0];
      if (order.status !== 'PENDING') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Order is already completed or cancelled' });
      }

      const orderItems = await query('SELECT * FROM order_items WHERE order_id = $1', [id]);

      // 2. Perform transactional checkout and inventory deduction
      const completedOrder = await transaction(async (client) => {
        // Fetch current medicine stock with lock (SELECT FOR UPDATE)
        const medIds = orderItems.map(item => item.medicine_id).filter(id => id !== null);
        
        const stockRows = medIds.length > 0 
          ? await client.query('SELECT id, drug_name, quantity FROM medicines WHERE id = ANY($1) FOR UPDATE', [medIds])
          : { rows: [] };

        // Verify and deduct stock using FEFO rules
        for (const item of orderItems) {
          if (!item.medicine_id) continue;

          // Get the drug profile (name and strength)
          const profileRes = await client.query('SELECT drug_name, strength FROM medicines WHERE id = $1', [item.medicine_id]);
          if (profileRes.rows.length === 0) {
            throw new Error(`Medicine ${item.drug_name} is no longer in the catalog`);
          }
          const { drug_name, strength } = profileRes.rows[0];

          // Fetch all active batches under FEFO
          const batchesRes = await client.query(
            'SELECT id, quantity, expiry_date, batch_number FROM medicines WHERE drug_name = $1 AND strength = $2 AND quantity > 0 ORDER BY expiry_date ASC FOR UPDATE',
            [drug_name, strength]
          );

          let remainingToDeduct = item.quantity;
          for (const batch of batchesRes.rows) {
            if (remainingToDeduct <= 0) break;
            
            const deductAmt = Math.min(batch.quantity, remainingToDeduct);
            await client.query(
              'UPDATE medicines SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [deductAmt, batch.id]
            );
            remainingToDeduct -= deductAmt;
          }

          if (remainingToDeduct > 0) {
            throw new Error(`Insufficient stock for ${drug_name} (${strength}) under FEFO rules. Needed additional: ${remainingToDeduct}`);
          }
        }

        // Update Order
        const updateResult = await client.query(
          `UPDATE orders
           SET status = 'COMPLETED',
               payment_method = $1,
               completed_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [payment_method, id]
        );

        return updateResult.rows[0];
      });

      // Audit Log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [userId, 'CHECKOUT_ORDER', JSON.stringify({ orderId: id, orderNumber: order.order_number, payment_method, totalAmount: order.total_amount }), req.ip]
      );

      return res.status(200).json({
        message: 'Order completed and paid successfully',
        order: completedOrder,
        items: orderItems,
      });
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Insufficient stock')) {
          return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * DELETE /api/v1/orders/:id
   * Manager: Cancels an order
   */
  public static async cancelOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const managerId = req.user?.id;

    try {
      const orderRows = await query('SELECT * FROM orders WHERE id = $1', [id]);
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
      }

      const order = orderRows[0];
      if (order.status !== 'PENDING') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot cancel a ${order.status} order` });
      }

      await query(`UPDATE orders SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [managerId, 'CANCEL_ORDER', JSON.stringify({ orderId: id, orderNumber: order.order_number }), req.ip]
      );

      return res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/orders/:id/return
   * Pharmacist/Manager: Refund/return completed order
   */
  public static async returnOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!reason) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Reason for return is required' });
    }

    try {
      const result = await transaction(async (client) => {
        // Fetch order
        const orderRows = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRows.rows.length === 0) throw new Error('Order not found');
        const order = orderRows.rows[0];

        if (order.status !== 'COMPLETED') throw new Error('Only completed orders can be returned');

        // Fetch items and restore stock
        const itemsRows = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        for (const item of itemsRows.rows) {
          if (item.medicine_id) {
            await client.query(
              'UPDATE medicines SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [item.quantity, item.medicine_id]
            );
          }
        }

        // Update order status
        await client.query("UPDATE orders SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

        // Insert order return record
        const returnInsert = await client.query(
          `INSERT INTO order_returns (order_id, refund_amount, reason, returned_by)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, order.total_amount, reason, userId]
        );

        return returnInsert.rows[0];
      });

      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [userId, 'ORDER_RETURN', JSON.stringify({ orderId: id, refundAmount: result.refund_amount }), req.ip]
      );

      return res.status(200).json({ message: 'Order returned successfully', return: result });
    } catch (err: any) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
    }
  }
}
