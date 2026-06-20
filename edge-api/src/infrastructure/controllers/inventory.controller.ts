import { Response } from 'express';
import { dbRead, dbWrite, getNextSequenceNumber } from '../db/sqlite-client';

export class EdgeInventoryController {
  /**
   * GET /api/v1/inventory/products
   * Returns list of products synced from central catalog.
   */
  public static async getProducts(req: any, res: Response) {
    try {
      const products = await dbRead(async (db) => {
        return db.all('SELECT * FROM products ORDER BY sku');
      });
      return res.status(200).json(products);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * GET /api/v1/inventory/stock
   * Computes local stock level dynamically from the append-only ledger events.
   */
  public static async getStock(req: any, res: Response) {
    try {
      const stock = await dbRead(async (db) => {
        return db.all(`
          SELECT 
            sm.product_id, 
            p.sku as product_sku, 
            p.name as product_name, 
            p.category, 
            sm.batch_number, 
            sm.expiry_date,
            SUM(sm.quantity_change) as quantity
          FROM stock_movements sm
          JOIN products p ON sm.product_id = p.id
          GROUP BY sm.product_id, p.sku, p.name, p.category, sm.batch_number, sm.expiry_date
          HAVING SUM(sm.quantity_change) > 0
          ORDER BY p.sku, sm.expiry_date
        `);
      });
      return res.status(200).json(stock);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  /**
   * POST /api/v1/inventory/adjustment
   * Records a local adjustment in SQLite and queues it for sync.
   */
  public static async createAdjustment(req: any, res: Response) {
    const { productId, batchNumber, expiryDate, quantityChange, type } = req.body;
    const userId = req.user?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const branchId = req.user?.branchId || '22222222-2222-2222-2222-222222222222';

    if (!productId || !batchNumber || !expiryDate || quantityChange === undefined || !type) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'productId, batchNumber, expiryDate, quantityChange, and type are required',
      });
    }

    try {
      const result = await dbWrite(async (db) => {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        // 1. Insert local ledger event
        await db.run(
          `INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, productId, branchId, batchNumber, expiryDate, quantityChange, type, userId, id, timestamp]
        );

        // 2. Queue for syncing
        const seq = await getNextSequenceNumber(db, branchId);
        const syncPayload = {
          id,
          product_id: productId,
          branch_id: branchId,
          batch_number: batchNumber,
          expiry_date: expiryDate,
          quantity_change: quantityChange,
          type,
          user_id: userId,
          reference_id: id,
          created_at: timestamp,
        };

        await db.run(
          `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
           VALUES (?, ?, ?, '1.0.0', 'STOCK_MOVEMENT', 'CREATE', ?, ?)`,
          [id, branchId, seq, JSON.stringify(syncPayload), timestamp]
        );

        return { id, quantityChange, type, timestamp };
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
