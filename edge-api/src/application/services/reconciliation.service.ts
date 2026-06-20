import { dbWrite, dbRead, getNextSequenceNumber } from '../../infrastructure/db/sqlite-client';

export class ReconciliationService {
  /**
   * Opens a new shift for a cashier.
   */
  public static async openShift(userId: string, branchId: string, openingCash: number): Promise<any> {
    return dbWrite(async (db) => {
      // Check if user has an already open shift
      const active = await db.get(
        'SELECT id FROM shifts WHERE user_id = ? AND status = "OPEN"',
        [userId]
      );
      if (active) {
        throw new Error('Shift already active: You must close your current shift before opening a new one.');
      }

      const shiftId = crypto.randomUUID();
      const openedAt = new Date().toISOString();

      await db.run(
        `INSERT INTO shifts (id, branch_id, user_id, opened_at, opening_cash, status)
         VALUES (?, ?, ?, ?, ?, 'OPEN')`,
        [shiftId, branchId, userId, openedAt, openingCash]
      );

      return { id: shiftId, openedAt, openingCash };
    });
  }

  /**
   * Closes a shift with blind cash counting, calculates variance, and queues sync outbox event.
   */
  public static async closeShift(userId: string, branchId: string, physicalClosingCash: number): Promise<any> {
    return dbWrite(async (db) => {
      const active = await db.get(
        'SELECT * FROM shifts WHERE user_id = ? AND status = "OPEN"',
        [userId]
      );
      if (!active) {
        throw new Error('No active shift found to close.');
      }

      const closedAt = new Date().toISOString();

      // Aggregate all CASH sales made in this shift (after opened_at)
      const salesTotal = await db.get(
        `SELECT SUM(total_amount) as total 
         FROM sales 
         WHERE user_id = ? AND branch_id = ? AND payment_method = "CASH" AND created_at >= ?`,
        [userId, branchId, active.opened_at]
      );

      const cashSalesSum = salesTotal?.total ? parseFloat(salesTotal.total) : 0;
      const expectedClosingCash = active.opening_cash + cashSalesSum;
      const variance = physicalClosingCash - expectedClosingCash;

      // Close local shift
      await db.run(
        `UPDATE shifts 
         SET closed_at = ?, expected_closing_cash = ?, physical_closing_cash = ?, variance = ?, status = "CLOSED"
         WHERE id = ?`,
        [closedAt, expectedClosingCash, physicalClosingCash, variance, active.id]
      );

      // Audit log the closure and variance flags if large (e.g. > $50 difference)
      const isDiscrepancyLarge = Math.abs(variance) >= 50;
      const auditAction = isDiscrepancyLarge ? 'SHIFT_RECONCILE_DISCREPANCY_FLAG' : 'SHIFT_RECONCILE_OK';
      const auditDetails = JSON.stringify({
        shiftId: active.id,
        openedAt: active.opened_at,
        closedAt,
        openingCash: active.opening_cash,
        cashSalesSum,
        expectedClosingCash,
        physicalClosingCash,
        variance,
        flagged: isDiscrepancyLarge,
      });

      const auditId = crypto.randomUUID();
      await db.run(
        `INSERT INTO audit_logs (id, user_id, action_type, timestamp, branch_id, payload_snapshot)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [auditId, userId, auditAction, closedAt, branchId, auditDetails]
      );

      // Queue shift sync payload to central
      const seqShift = await getNextSequenceNumber(db, branchId);
      const shiftSyncPayload = {
        id: active.id,
        branch_id: branchId,
        user_id: userId,
        opened_at: active.opened_at,
        closed_at: closedAt,
        opening_cash: active.opening_cash,
        expected_closing_cash: expectedClosingCash,
        physical_closing_cash: physicalClosingCash,
        variance,
        status: 'CLOSED',
      };

      await db.run(
        `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
         VALUES (?, ?, ?, '1.0.0', 'SHIFT_RECONCILIATION', 'CREATE', ?, ?)`,
        [active.id, branchId, seqShift, JSON.stringify(shiftSyncPayload), closedAt]
      );

      // Queue Audit logs
      const seqAudit = await getNextSequenceNumber(db, branchId);
      await db.run(
        `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
         VALUES (?, ?, ?, '1.0.0', 'AUDIT_LOG', 'CREATE', ?, ?)`,
        [
          crypto.randomUUID(),
          branchId,
          seqAudit,
          JSON.stringify({
            id: auditId,
            user_id: userId,
            action_type: auditAction,
            timestamp: closedAt,
            branch_id: branchId,
            payload_snapshot: auditDetails,
          }),
          closedAt,
        ]
      );

      return {
        shiftId: active.id,
        openedAt: active.opened_at,
        closedAt,
        openingCash: active.opening_cash,
        cashSalesSum,
        expectedClosingCash,
        physicalClosingCash,
        variance,
        flagged: isDiscrepancyLarge,
      };
    });
  }

  /**
   * Retrieves user current shift details.
   */
  public static async getCurrentShift(userId: string): Promise<any> {
    return dbRead(async (db) => {
      const active = await db.get(
        'SELECT * FROM shifts WHERE user_id = ? AND status = "OPEN"',
        [userId]
      );
      return active || null;
    });
  }
}
