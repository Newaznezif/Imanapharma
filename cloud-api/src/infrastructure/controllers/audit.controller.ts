import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../db/pg-client';

export class AuditController {
  /**
   * GET /api/v1/audit/logs
   * Retrieves all immutable system audit logs.
   */
  public static async getLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const logs = await query(`
        SELECT 
          al.id, 
          al.user_id, 
          u.username,
          al.action_type, 
          al.timestamp, 
          al.branch_id, 
          b.name as branch_name,
          al.payload_snapshot, 
          al.before_state, 
          al.after_state
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN branches b ON al.branch_id = b.id
        ORDER BY al.timestamp DESC
        LIMIT 200
      `);

      return res.status(200).json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
