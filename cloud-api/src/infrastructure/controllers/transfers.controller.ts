import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, transaction } from '../db/pg-client';

export class TransfersController {
  /**
   * GET /api/v1/transfers
   * Lists all inter-branch transfers
   */
  public static async getTransfers(req: AuthenticatedRequest, res: Response) {
    try {
      const transfers = await query(`
        SELECT 
          t.id, 
          t.from_branch_id, 
          fb.name as from_branch_name,
          t.to_branch_id, 
          tb.name as to_branch_name,
          t.status, 
          t.requested_by, 
          ru.username as requested_by_username,
          t.approved_by, 
          au.username as approved_by_username,
          t.created_at, 
          t.updated_at
        FROM transfers t
        JOIN branches fb ON t.from_branch_id = fb.id
        JOIN branches tb ON t.to_branch_id = tb.id
        JOIN users ru ON t.requested_by = ru.id
        LEFT JOIN users au ON t.approved_by = au.id
        ORDER BY t.created_at DESC
      `);

      for (const t of transfers) {
        t.items = await query(
          `SELECT ti.id, ti.product_id, p.sku as product_sku, p.name as product_name, ti.requested_qty, ti.shipped_qty, ti.received_qty
           FROM transfer_items ti
           JOIN products p ON ti.product_id = p.id
           WHERE ti.transfer_id = $1`,
          [t.id]
        );
      }

      return res.status(200).json(transfers);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/transfers
   * Creates a new stock transfer request from Branch A to Branch B.
   */
  public static async createTransfer(req: AuthenticatedRequest, res: Response) {
    const { fromBranchId, toBranchId, items } = req.body;
    const userId = req.user?.id;

    if (!fromBranchId || !toBranchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'fromBranchId, toBranchId, and non-empty items array are required',
      });
    }

    try {
      const transferId = crypto.randomUUID();

      await transaction(async (client) => {
        // Create transfer record
        await client.query(
          `INSERT INTO transfers (id, from_branch_id, to_branch_id, status, requested_by, updated_at)
           VALUES ($1, $2, $3, 'REQUESTED', $4, CURRENT_TIMESTAMP)`,
          [transferId, fromBranchId, toBranchId, userId]
        );

        // Create transfer items
        for (const item of items) {
          await client.query(
            `INSERT INTO transfer_items (transfer_id, product_id, requested_qty)
             VALUES ($1, $2, $3)`,
            [transferId, item.productId, item.requestedQty]
          );
        }

        // Write audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action_type, branch_id, payload_snapshot)
           VALUES ($1, 'TRANSFER_REQUEST', $2, $3)`,
          [userId, toBranchId, JSON.stringify({ transferId, fromBranchId, items })]
        );
      });

      return res.status(201).json({ id: transferId, status: 'REQUESTED' });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/transfers/:id/approve
   * Approves a transfer request.
   */
  public static async approveTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE transfers 
           SET status = 'APPROVED', approved_by = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [userId, id]
        );

        await client.query(
          `INSERT INTO audit_logs (user_id, action_type, payload_snapshot)
           VALUES ($1, 'TRANSFER_APPROVED', $2)`,
          [userId, JSON.stringify({ transferId: id })]
        );
      });

      return res.status(200).json({ id, status: 'APPROVED' });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/transfers/:id/dispatch
   * Marks a transfer as dispatched. Deducts stock at the source branch ('TRANSFER_OUT' events).
   */
  public static async dispatchTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { items } = req.body; // Array of { productId, batchNumber, expiryDate, shippedQty }
    const userId = req.user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'shipped items array is required' });
    }

    try {
      await transaction(async (client) => {
        // Update status and item quantities
        await client.query(
          `UPDATE transfers 
           SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [id]
        );

        const transferDetails = await client.query('SELECT from_branch_id FROM transfers WHERE id = $1', [id]);
        const fromBranchId = transferDetails.rows[0].from_branch_id;

        for (const item of items) {
          // Update shipped quantity on transfer item
          await client.query(
            `UPDATE transfer_items 
             SET shipped_qty = $1 
             WHERE transfer_id = $2 AND product_id = $3`,
            [item.shippedQty, id, item.productId]
          );

          // Append STOCK_OUT / TRANSFER_OUT to source branch inventory ledger
          await client.query(
            `INSERT INTO stock_movements (product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id)
             VALUES ($1, $2, $3, $4, $5, 'TRANSFER_OUT', $6, $7)`,
            [
              item.productId,
              fromBranchId,
              item.batchNumber,
              item.expiryDate,
              -item.shippedQty, // Negative value for stock reduction
              userId,
              id,
            ]
          );
        }

        await client.query(
          `INSERT INTO audit_logs (user_id, action_type, branch_id, payload_snapshot)
           VALUES ($1, 'TRANSFER_DISPATCHED', $2, $3)`,
          [userId, fromBranchId, JSON.stringify({ transferId: id, items })]
        );
      });

      return res.status(200).json({ id, status: 'DISPATCHED' });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/transfers/:id/complete
   * Marks a transfer as completed. Adds stock at the receiving branch ('TRANSFER_IN' events).
   */
  public static async completeTransfer(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { items } = req.body; // Array of { productId, batchNumber, expiryDate, receivedQty }
    const userId = req.user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'received items array is required' });
    }

    try {
      await transaction(async (client) => {
        // Update transfer status to COMPLETED
        await client.query(
          `UPDATE transfers 
           SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [id]
        );

        const transferDetails = await client.query('SELECT to_branch_id FROM transfers WHERE id = $1', [id]);
        const toBranchId = transferDetails.rows[0].to_branch_id;

        for (const item of items) {
          // Update received quantity
          await client.query(
            `UPDATE transfer_items 
             SET received_qty = $1 
             WHERE transfer_id = $2 AND product_id = $3`,
            [item.receivedQty, id, item.productId]
          );

          // Append TRANSFER_IN to receiving branch inventory ledger
          await client.query(
            `INSERT INTO stock_movements (product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id)
             VALUES ($1, $2, $3, $4, $5, 'TRANSFER_IN', $6, $7)`,
            [
              item.productId,
              toBranchId,
              item.batchNumber,
              item.expiryDate,
              item.receivedQty, // Positive value for stock addition
              userId,
              id,
            ]
          );
        }

        await client.query(
          `INSERT INTO audit_logs (user_id, action_type, branch_id, payload_snapshot)
           VALUES ($1, 'TRANSFER_COMPLETED', $2, $3)`,
          [userId, toBranchId, JSON.stringify({ transferId: id, items })]
        );
      });

      return res.status(200).json({ id, status: 'COMPLETED' });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
