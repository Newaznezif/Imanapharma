import { Response } from 'express';
import { SalesService, CheckoutPayload } from '../../application/services/sales.service';
import { dbRead } from '../db/sqlite-client';

export class SalesController {
  /**
   * POST /api/v1/sales
   * Performs retail sale checkouts.
   */
  public static async checkout(req: any, res: Response) {
    const { items, paymentMethod, taxAmount, discountAmount, prescription, patientAllergyFlags, pharmacistOverrideCredentials } = req.body;
    const userId = req.user?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // Fallback for testing/offline bypass if no auth middleware active
    const branchId = req.user?.branchId || '22222222-2222-2222-2222-222222222222';

    if (!Array.isArray(items) || items.length === 0 || !paymentMethod) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'items (array) and paymentMethod are required',
      });
    }

    try {
      const saleId = crypto.randomUUID();
      const payload: CheckoutPayload = {
        saleId,
        userId,
        branchId,
        items,
        paymentMethod,
        taxAmount: taxAmount || 0,
        discountAmount: discountAmount || 0,
        prescription,
        patientAllergyFlags,
        pharmacistOverrideCredentials,
      };

      const result = await SalesService.checkout(payload);
      return res.status(201).json(result);
    } catch (err: any) {
      console.warn('[Checkout Failure]', err.message);
      return res.status(400).json({
        error: 'TRANSACTION_BLOCKED',
        message: err.message || 'The checkout transaction could not be processed.',
      });
    }
  }

  /**
   * GET /api/v1/sales
   * Returns list of sales recorded at this local branch.
   */
  public static async getSales(req: any, res: Response) {
    try {
      const sales = await dbRead(async (db) => {
        return db.all('SELECT * FROM sales ORDER BY created_at DESC');
      });
      return res.status(200).json(sales);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
