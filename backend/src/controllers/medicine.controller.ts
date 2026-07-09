import { Response } from 'express';
import { query } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { validatePrice, sanitizeString } from '../middleware/validate';

export class MedicineController {
  /**
   * GET /api/v1/medicines
   * Supports search via query parameter ?q=
   */
  public static async getMedicines(req: AuthenticatedRequest, res: Response) {
    const { q } = req.query;
    try {
      let medicines;
      if (q) {
        const searchTerm = `%${String(q)}%`;
        const sqlQuery = `
          SELECT id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level, created_at, updated_at 
          FROM medicines 
          WHERE drug_name ILIKE $1 
             OR manufacturer ILIKE $1 
             OR batch_number ILIKE $1
             OR barcode ILIKE $1
          ORDER BY drug_name ASC
        `;
        medicines = await query(sqlQuery, [searchTerm]);
      } else {
        medicines = await query('SELECT id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level, created_at, updated_at FROM medicines ORDER BY drug_name ASC');
      }
      return res.status(200).json(medicines);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/medicines
   */
  public static async createMedicine(req: AuthenticatedRequest, res: Response) {
    const {
      drug_name,
      category,
      strength,
      price,
      quantity,
      expiry_date,
      manufacturer,
      batch_number,
      barcode,
      min_reorder_level
    } = req.body;

    if (!drug_name || !category || !strength || price === undefined || quantity === undefined || !expiry_date || !manufacturer || !batch_number) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'All medicine fields are required' });
    }

    const VALID_CATEGORIES = ['Rx', 'OTC', 'PRESCRIPTION', 'CONTROLLED', 'SUPPLEMENT', 'COSMETIC', 'VETERINARY'];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid medicine category' });
    }

    const priceVal = validatePrice(price);
    if (!priceVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: priceVal.message });

    if (!Number.isInteger(quantity) || quantity < 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Quantity must be a non-negative integer' });
    }

    // Validate date format (YYYY-MM-DD roughly)
    if (isNaN(Date.parse(expiry_date))) {
          return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid expiry date format' });
    }

    try {
      const result = await query(
        `INSERT INTO medicines (drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level, created_at, updated_at`,
        [sanitizeString(drug_name), category, sanitizeString(strength), price, quantity, expiry_date, sanitizeString(manufacturer), sanitizeString(batch_number), barcode || null, min_reorder_level || 10]
      );

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'CREATE_MEDICINE', JSON.stringify({ drug_name, batch_number, quantity, price }), req.ip]
      );

      return res.status(201).json(result[0]);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
          return res.status(409).json({ error: 'CONFLICT', message: 'A medicine with this batch number and manufacturer already exists' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * PUT /api/v1/medicines/:id
   */
  public static async updateMedicine(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const {
      drug_name,
      category,
      strength,
      price,
      quantity,
      expiry_date,
      manufacturer,
      batch_number,
      barcode,
      min_reorder_level
    } = req.body;

    const VALID_CATEGORIES = ['Rx', 'OTC', 'PRESCRIPTION', 'CONTROLLED', 'SUPPLEMENT', 'COSMETIC', 'VETERINARY'];
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid medicine category' });
    }

    if (price !== undefined) {
      const priceVal = validatePrice(price);
      if (!priceVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: priceVal.message });
    }

    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0)) {
       return res.status(400).json({ error: 'BAD_REQUEST', message: 'Quantity must be a non-negative integer' });
    }

    if (expiry_date !== undefined && isNaN(Date.parse(expiry_date))) {
       return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid expiry date format' });
    }

    try {
      const result = await query(
        `UPDATE medicines
         SET drug_name = COALESCE($1, drug_name),
             category = COALESCE($2, category),
             strength = COALESCE($3, strength),
             price = COALESCE($4, price),
             quantity = COALESCE($5, quantity),
             expiry_date = COALESCE($6, expiry_date),
             manufacturer = COALESCE($7, manufacturer),
             batch_number = COALESCE($8, batch_number),
             barcode = COALESCE($9, barcode),
             min_reorder_level = COALESCE($10, min_reorder_level),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING id, drug_name, category, strength, price, quantity, expiry_date, manufacturer, batch_number, barcode, min_reorder_level, created_at, updated_at`,
        [
          drug_name ? sanitizeString(drug_name) : null,
          category,
          strength ? sanitizeString(strength) : null,
          price,
          quantity,
          expiry_date,
          manufacturer ? sanitizeString(manufacturer) : null,
          batch_number ? sanitizeString(batch_number) : null,
          barcode,
          min_reorder_level,
          id
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Medicine not found' });
      }

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'UPDATE_MEDICINE', JSON.stringify({ medicineId: id, drug_name, quantity, price }), req.ip]
      );

      return res.status(200).json(result[0]);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
          return res.status(409).json({ error: 'CONFLICT', message: 'A medicine with this batch number and manufacturer already exists' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * DELETE /api/v1/medicines/:id
   */
  public static async deleteMedicine(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const result = await query('DELETE FROM medicines WHERE id = $1 RETURNING drug_name, batch_number', [id]);
      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Medicine not found' });
      }

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'DELETE_MEDICINE', JSON.stringify({ medicineId: id, drug_name: result[0].drug_name, batch_number: result[0].batch_number }), req.ip]
      );

      return res.status(200).json({ message: `Medicine ${result[0].drug_name} deleted` });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  // ── Stock Adjustments & Reconciliation ───────────────────────────────

  public static async adjustStock(req: AuthenticatedRequest, res: Response) {
    const { medicine_id, quantity_adjusted, reason, notes } = req.body;
    const userId = req.user?.id;

    if (!medicine_id || quantity_adjusted === undefined || !reason) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'medicine_id, quantity_adjusted, and reason are required' });
    }

    try {
      const adjustResult = await query(
        `INSERT INTO stock_adjustments (medicine_id, quantity_adjusted, reason, notes, adjusted_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [medicine_id, quantity_adjusted, reason, notes, userId]
      );

      // Apply the adjustment to the medicine inventory directly
      await query(
        'UPDATE medicines SET quantity = GREATEST(0, quantity + $1) WHERE id = $2',
        [quantity_adjusted, medicine_id]
      );

      return res.status(201).json(adjustResult[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  public static async getInventoryAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      // 1. Low Stock Alert
      const lowStock = await query(
        'SELECT id, drug_name, strength, quantity, min_reorder_level FROM medicines WHERE quantity <= min_reorder_level'
      );

      // 2. Near Expiry Alert (within 30 days)
      const nearExpiry = await query(
        "SELECT id, drug_name, strength, quantity, expiry_date FROM medicines WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'"
      );

      // 3. Expired Alert
      const expired = await query(
        "SELECT id, drug_name, strength, quantity, expiry_date FROM medicines WHERE expiry_date < CURRENT_DATE"
      );

      return res.status(200).json({
        lowStock,
        nearExpiry,
        expired
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
