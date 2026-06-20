import express from 'express';
import cors from 'cors';
import { config } from './config';
import { query } from './infrastructure/db/pg-client';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { SyncController } from './infrastructure/controllers/sync.controller';
import { InventoryController } from './infrastructure/controllers/inventory.controller';
import { TransfersController } from './infrastructure/controllers/transfers.controller';
import { AuditController } from './infrastructure/controllers/audit.controller';
import { authMiddleware, requireRole } from './infrastructure/middleware/auth';
import { idempotencyMiddleware } from './infrastructure/middleware/idempotency';

const app = express();

app.use(cors());
app.use(express.json());

// Idempotency Middleware applied globally (internal checks target mutating REST resources)
app.use(idempotencyMiddleware);

// Public Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

// Authentication Router
app.post('/api/v1/auth/login', AuthController.login);
app.post('/api/v1/auth/refresh', AuthController.refresh);
app.post('/api/v1/auth/register', authMiddleware, requireRole(['ADMIN']), AuthController.register);

// Sync Ingestion Endpoint (Branch local daemon syncs to cloud)
app.post('/api/v1/sync', authMiddleware, SyncController.sync);

// Branches Catalog
app.get('/api/v1/branches', authMiddleware, async (req, res) => {
  try {
    const branches = await query('SELECT id, name, location, is_active FROM branches ORDER BY name');
    res.status(200).json(branches);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// Inventory Resource
app.get('/api/v1/inventory/products', authMiddleware, InventoryController.getProducts);
app.post('/api/v1/inventory/products', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), InventoryController.createProduct);
app.get('/api/v1/inventory/stock', authMiddleware, InventoryController.getGlobalStock);
app.get('/api/v1/inventory/branch/:branchId', authMiddleware, InventoryController.getBranchStock);
app.post('/api/v1/inventory/adjustment', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER', 'PHARMACIST']), InventoryController.createAdjustment);

// Inter-Branch Transfers
app.get('/api/v1/transfers', authMiddleware, TransfersController.getTransfers);
app.post('/api/v1/transfers', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), TransfersController.createTransfer);
app.post('/api/v1/transfers/:id/approve', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), TransfersController.approveTransfer);
app.post('/api/v1/transfers/:id/dispatch', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), TransfersController.dispatchTransfer);
app.post('/api/v1/transfers/:id/complete', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), TransfersController.completeTransfer);

// Audit Ledgers
app.get('/api/v1/audit/logs', authMiddleware, requireRole(['ADMIN', 'BRANCH_MANAGER']), AuditController.getLogs);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[UNHANDLED EXCEPTION]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected server error occurred.',
  });
});

app.listen(config.port, () => {
  console.log(`Cloud Central API listening on port ${config.port}`);
});
