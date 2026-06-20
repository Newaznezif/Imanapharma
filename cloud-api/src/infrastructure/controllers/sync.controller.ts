import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SyncOrchestrator } from '../../application/services/sync-orchestrator';

export class SyncController {
  /**
   * POST /api/v1/sync
   * Receives synchronized transactions from branch nodes.
   */
  public static async sync(req: AuthenticatedRequest, res: Response) {
    const event = req.body;

    if (!event || !event.event_uuid || !event.branch_id || !event.sequence_number || !event.schema_version) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Invalid sync event payload structures. Missing required attributes.',
      });
    }

    try {
      const result = await SyncOrchestrator.processEvent(event);
      if (!result.success) {
        // Return 202 ACCEPTED indicating that the event failed validation but was logged to DLQ 
        // to prevent blocking the edge FIFO queue.
        return res.status(202).json({
          status: 'DLQ_ARCHIVED',
          message: result.message,
        });
      }

      return res.status(200).json({
        status: 'SYNCED',
        message: result.message,
      });
    } catch (error: any) {
      // If sequence check throws an error, return 409 conflict/400 bad request.
      // This tells the Edge sync daemon to HOLD and retry earlier items first.
      console.warn(`[Sync Warning] FIFO sequence gap or locking exception: ${error.message}`);
      return res.status(409).json({
        error: 'SEQUENCE_GAP',
        message: error.message || 'Sequence order exception occurred.',
      });
    }
  }
}
