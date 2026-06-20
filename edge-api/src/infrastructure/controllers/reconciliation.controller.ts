import { Response } from 'express';
import { ReconciliationService } from '../../application/services/reconciliation.service';

export class ReconciliationController {
  public static async openShift(req: any, res: Response) {
    const { openingCash } = req.body;
    const userId = req.user?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const branchId = req.user?.branchId || '22222222-2222-2222-2222-222222222222';

    if (openingCash === undefined || openingCash < 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid openingCash is required' });
    }

    try {
      const result = await ReconciliationService.openShift(userId, branchId, openingCash);
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: 'SHIFT_ERROR', message: err.message });
    }
  }

  public static async closeShift(req: any, res: Response) {
    const { physicalClosingCash } = req.body;
    const userId = req.user?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const branchId = req.user?.branchId || '22222222-2222-2222-2222-222222222222';

    if (physicalClosingCash === undefined || physicalClosingCash < 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid physicalClosingCash is required' });
    }

    try {
      const result = await ReconciliationService.closeShift(userId, branchId, physicalClosingCash);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: 'SHIFT_ERROR', message: err.message });
    }
  }

  public static async getCurrentShift(req: any, res: Response) {
    const userId = req.user?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    try {
      const result = await ReconciliationService.getCurrentShift(userId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
