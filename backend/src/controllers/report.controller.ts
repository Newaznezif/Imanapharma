import { Response } from 'express';
import { query } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';

export class ReportController {
  /**
   * GET /api/v1/reports/dashboard-overview
   * Restricted to: MANAGER
   */
  public static async getDashboardOverview(req: AuthenticatedRequest, res: Response) {
    try {
      const [productsCount, pharmacistsCount, salesResult, lowStockCount, nearExpiryCount, expiredCount] = await Promise.all([
        query('SELECT COUNT(*)::int as count FROM medicines'),
        query("SELECT COUNT(*)::int as count FROM users WHERE role = 'PHARMACIST' AND is_active = true"),
        query("SELECT COUNT(*)::int as count, COALESCE(SUM(total_amount), 0)::float as revenue FROM orders WHERE status = 'COMPLETED'"),
        query('SELECT COUNT(*)::int as count FROM medicines WHERE quantity <= min_reorder_level'),
        query("SELECT COUNT(*)::int as count FROM medicines WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'"),
        query("SELECT COUNT(*)::int as count FROM medicines WHERE expiry_date < CURRENT_DATE"),
      ]);

      return res.status(200).json({
        totalProducts: productsCount[0].count,
        totalPharmacists: pharmacistsCount[0].count,
        totalSales: salesResult[0].count,
        totalRevenue: salesResult[0].revenue,
        lowStockItems: lowStockCount[0].count,
        nearExpiryItems: nearExpiryCount[0].count,
        expiredItems: expiredCount[0].count,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/reports/sales-history
   * Allows filtering by date range, status, payment method
   */
  public static async getSalesHistory(req: AuthenticatedRequest, res: Response) {
    const { status, payment_method, q, from, to, page = '1', limit = '50' } = req.query;
    try {
      let sql = `
        SELECT o.id, o.order_number, o.patient_name, o.total_amount, o.discount_percent, o.tax_percent,
               o.payment_method, o.status, o.created_at, o.completed_at,
               u1.username as pharmacist_name
        FROM orders o
        LEFT JOIN users u1 ON o.pharmacist_id = u1.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) { params.push(status); sql += ` AND o.status = $${params.length}`; }
      if (payment_method) { params.push(payment_method); sql += ` AND o.payment_method = $${params.length}`; }
      if (q) { params.push(`%${String(q)}%`); sql += ` AND o.patient_name ILIKE $${params.length}`; }
      if (from) { params.push(from); sql += ` AND o.created_at >= $${params.length}`; }
      if (to)   { params.push(to);   sql += ` AND o.created_at <= $${params.length}`; }

      const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));
      sql += ` ORDER BY o.created_at DESC LIMIT ${parseInt(String(limit))} OFFSET ${offset}`;

      const rows = await query(sql, params);
      return res.status(200).json(rows);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/reports/charts
   * Returns comprehensive chart data
   */
  public static async getChartsData(req: AuthenticatedRequest, res: Response) {
    try {
      const [
        monthlySales,
        topSelling,
        slowMoving,
        paymentSummary,
        lowStockDetails,
        nearExpiryDetails,
        expiredDetails,
        inventoryValuation
      ] = await Promise.all([
        // Monthly Sales Revenue (last 12 months)
        query(`
          SELECT 
            TO_CHAR(completed_at, 'YYYY-MM') as month,
            COALESCE(SUM(total_amount), 0)::float as revenue,
            COUNT(*)::int as transactions
          FROM orders
          WHERE status = 'COMPLETED' AND completed_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY TO_CHAR(completed_at, 'YYYY-MM')
          ORDER BY month ASC
        `),
        // Top-Selling Products (by volume)
        query(`
          SELECT 
            oi.drug_name,
            SUM(oi.quantity)::int as total_qty,
            SUM(oi.total_price)::float as total_sales
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status = 'COMPLETED'
          GROUP BY oi.drug_name
          ORDER BY total_qty DESC
          LIMIT 10
        `),
        // Slow-Moving Products (dispensed < 5 in 90 days)
        query(`
          SELECT m.drug_name, m.strength, m.quantity,
            COALESCE(SUM(oi.quantity), 0)::int as dispensed_last_90d
          FROM medicines m
          LEFT JOIN order_items oi ON oi.medicine_id = m.id
          LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'COMPLETED' 
            AND o.completed_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY m.id, m.drug_name, m.strength, m.quantity
          HAVING COALESCE(SUM(oi.quantity), 0) < 5
          ORDER BY dispensed_last_90d ASC
          LIMIT 10
        `),
        // Revenue by Payment Method
        query(`
          SELECT 
            COALESCE(payment_method, 'UNKNOWN') as payment_method,
            COALESCE(SUM(total_amount), 0)::float as revenue,
            COUNT(*)::int as count
          FROM orders
          WHERE status = 'COMPLETED'
          GROUP BY payment_method
        `),
        // Low Stock
        query(`
          SELECT id, drug_name, strength, quantity, min_reorder_level, batch_number, expiry_date
          FROM medicines
          WHERE quantity <= min_reorder_level
          ORDER BY quantity ASC
          LIMIT 20
        `),
        // Near Expiry (30 days)
        query(`
          SELECT id, drug_name, strength, quantity, expiry_date, batch_number
          FROM medicines
          WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          ORDER BY expiry_date ASC
          LIMIT 20
        `),
        // Expired
        query(`
          SELECT id, drug_name, strength, quantity, expiry_date, batch_number
          FROM medicines
          WHERE expiry_date < CURRENT_DATE
          ORDER BY expiry_date ASC
          LIMIT 20
        `),
        // Inventory Valuation (price * quantity)
        query(`
          SELECT 
            category,
            COUNT(*)::int as sku_count,
            SUM(quantity)::int as total_units,
            COALESCE(SUM(price * quantity), 0)::float as total_value
          FROM medicines
          GROUP BY category
        `),
      ]);

      return res.status(200).json({
        monthlySales,
        topSelling,
        slowMoving,
        paymentSummary,
        lowStockDetails,
        nearExpiryDetails,
        expiredDetails,
        inventoryValuation,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/reports/audit-logs
   */
  public static async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    const { q, from, to, page = '1', limit = '100' } = req.query;
    try {
      let sql = `
        SELECT a.id, a.action_type, a.payload, a.ip_address, a.created_at, u.username
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (q) { params.push(`%${String(q)}%`); sql += ` AND (a.action_type ILIKE $${params.length} OR u.username ILIKE $${params.length})`; }
      if (from) { params.push(from); sql += ` AND a.created_at >= $${params.length}`; }
      if (to)   { params.push(to);   sql += ` AND a.created_at <= $${params.length}`; }

      const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));
      sql += ` ORDER BY a.created_at DESC LIMIT ${parseInt(String(limit))} OFFSET ${offset}`;

      const logs = await query(sql, params);
      return res.status(200).json(logs);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/reports/export/csv?type=medicines|orders|patients
   */
  public static async exportCSV(req: AuthenticatedRequest, res: Response) {
    const { type = 'orders' } = req.query;
    try {
      let rows: any[] = [];
      let filename = '';

      if (type === 'medicines') {
        rows = await query('SELECT drug_name, category, strength, manufacturer, batch_number, quantity, expiry_date, price, barcode FROM medicines ORDER BY drug_name');
        filename = 'medicines_inventory.csv';
      } else if (type === 'orders') {
        rows = await query(`
          SELECT o.order_number, o.patient_name, o.total_amount, o.payment_method, o.status, o.discount_percent, o.tax_percent, 
                 o.created_at, u.username as pharmacist
          FROM orders o LEFT JOIN users u ON o.pharmacist_id = u.id 
          ORDER BY o.created_at DESC`);
        filename = 'sales_history.csv';
      } else if (type === 'patients') {
        rows = await query('SELECT name, phone, allergy_flags::text, emergency_contact_name, insurance_provider FROM patients ORDER BY name');
        filename = 'patients.csv';
      } else if (type === 'audit') {
        rows = await query(`SELECT a.action_type, u.username, a.ip_address, a.payload::text, a.created_at FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 5000`);
        filename = 'audit_logs.csv';
      }

      if (rows.length === 0) {
        return res.status(200).send('No data to export');
      }

      // Manual CSV generation (avoids needing json2csv types)
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(','),
        ...rows.map(row =>
          headers.map(h => {
            const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
            return `"${val.replace(/"/g, '""')}"`;
          }).join(',')
        )
      ];
      const csv = csvLines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  /**
   * GET /api/v1/reports/export/excel?type=medicines|orders
   */
  public static async exportExcel(req: AuthenticatedRequest, res: Response) {
    const ExcelJS = require('exceljs');
    const { type = 'orders' } = req.query;

    try {
      let rows: any[] = [];
      let sheetName = 'Report';
      let filename = 'report.xlsx';

      if (type === 'medicines') {
        rows = await query('SELECT drug_name, category, strength, manufacturer, batch_number, quantity, expiry_date, price FROM medicines ORDER BY drug_name');
        sheetName = 'Medicines Inventory'; filename = 'medicines_inventory.xlsx';
      } else {
        rows = await query(`
          SELECT o.order_number, o.patient_name, o.total_amount, o.payment_method, o.status, o.created_at,
                 u.username as pharmacist
          FROM orders o LEFT JOIN users u ON o.pharmacist_id = u.id 
          ORDER BY o.created_at DESC LIMIT 5000`);
        sheetName = 'Sales History'; filename = 'sales_history.xlsx';
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ImanaPharma';
      const sheet = workbook.addWorksheet(sheetName);

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers.map(h => h.toUpperCase().replace(/_/g, ' ')));
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        for (const row of rows) {
          sheet.addRow(headers.map(h => {
            const v = row[h];
            if (v instanceof Date) return v.toISOString();
            return v === null ? '' : v;
          }));
        }
        sheet.columns.forEach((col: any) => { col.width = 20; });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
