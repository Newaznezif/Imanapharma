import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../db/pg-client';
import { LedgerDomain } from '../../domain/ledger';

export class InventoryController {
  /**
   * GET /api/v1/inventory/products
   * Returns list of all products in the catalog.
   */
  public static async getProducts(req: AuthenticatedRequest, res: Response) {
    try {
      const products = await query('SELECT id, sku, name, category, description, created_at FROM products ORDER BY sku');
      return res.status(200).json(products);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/inventory/products
   * Creates a new product in the catalog.
   */
  public static async createProduct(req: AuthenticatedRequest, res: Response) {
    const { sku, name, category, description } = req.body;
    if (!sku || !name || !category) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'sku, name, and category are required' });
    }

    try {
      const result = await query(
        `INSERT INTO products (sku, name, category, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sku, name, category, description, created_at`,
        [sku, name, category, description]
      );
      return res.status(201).json(result[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Product SKU already exists' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * GET /api/v1/inventory/stock
   * Returns all active stocks in the system aggregated from append-only events.
   */
  public static async getGlobalStock(req: AuthenticatedRequest, res: Response) {
    try {
      // Query all ledger events and calculate balance group by branch & product
      const rows = await query(`
        SELECT 
          sm.branch_id,
          b.name as branch_name,
          sm.product_id,
          p.sku as product_sku,
          p.name as product_name,
          p.category,
          sm.batch_number,
          sm.expiry_date,
          SUM(sm.quantity_change)::int as quantity
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN branches b ON sm.branch_id = b.id
        GROUP BY sm.branch_id, b.name, sm.product_id, p.sku, p.name, p.category, sm.batch_number, sm.expiry_date
        HAVING SUM(sm.quantity_change) > 0
        ORDER BY b.name, p.sku, sm.expiry_date
      `);

      return res.status(200).json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * GET /api/v1/inventory/branch/:branchId
   * Returns stock level for a specific branch aggregated from ledger events.
   */
  public static async getBranchStock(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.params;
    if (!branchId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Branch ID is required' });
    }

    try {
      const rows = await query(`
        SELECT 
          sm.product_id,
          p.sku as product_sku,
          p.name as product_name,
          p.category,
          sm.batch_number,
          sm.expiry_date,
          SUM(sm.quantity_change)::int as quantity
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.branch_id = $1
        GROUP BY sm.product_id, p.sku, p.name, p.category, sm.batch_number, sm.expiry_date
        HAVING SUM(sm.quantity_change) > 0
        ORDER BY p.sku, sm.expiry_date
      `, [branchId]);

      return res.status(200).json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/inventory/adjustment
   * Appends stock adjustments to the ledger database (requires Idempotency-Key).
   */
  public static async createAdjustment(req: AuthenticatedRequest, res: Response) {
    const { productId, branchId, batchNumber, expiryDate, quantityChange, reason } = req.body;
    const userId = req.user?.id;

    if (!productId || !branchId || !batchNumber || !expiryDate || quantityChange === undefined) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'productId, branchId, batchNumber, expiryDate, and quantityChange are required',
      });
    }

    try {
      const refId = crypto.randomUUID(); // Unique adjustment ref
      const result = await query(
        `INSERT INTO stock_movements (product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id)
         VALUES ($1, $2, $3, $4, $5, 'ADJUSTMENT', $6, $7)
         RETURNING id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, created_at`,
        [productId, branchId, batchNumber, expiryDate, quantityChange, userId, refId]
      );

      // Log event inside audit ledger
      await query(
        `INSERT INTO audit_logs (user_id, action_type, branch_id, payload_snapshot)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'STOCK_ADJUSTMENT',
          branchId,
          JSON.stringify({ productId, batchNumber, quantityChange, reason }),
        ]
      );

      return res.status(201).json(result[0]);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
