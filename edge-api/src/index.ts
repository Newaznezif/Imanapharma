import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './infrastructure/db/sqlite-client';
import { SalesController } from './infrastructure/controllers/sales.controller';
import { EdgeInventoryController } from './infrastructure/controllers/inventory.controller';
import { ReconciliationController } from './infrastructure/controllers/reconciliation.controller';
import { authMiddleware } from './infrastructure/middleware/auth';
import { SyncDaemon } from './application/services/sync-daemon';

const app = express();
const port = parseInt(process.env.PORT || '5001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_cloud_key_1234';

app.use(cors());
app.use(express.json());

// Public Health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ONLINE', mode: 'EDGE_NODE', timestamp: new Date().toISOString() });
});

// Offline-Capable Login Endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password are required' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid offline username or password' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid offline username or password' });
    }

    // Sign session token matching Cloud layout
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, branchId: user.branch_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        created_at: user.created_at,
      }
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// Mount Local POS Checkout Routes
app.post('/api/v1/sales', authMiddleware, SalesController.checkout);
app.get('/api/v1/sales', authMiddleware, SalesController.getSales);

// Mount Local Inventory Queries & Additions
app.get('/api/v1/inventory/products', authMiddleware, EdgeInventoryController.getProducts);
app.get('/api/v1/inventory/stock', authMiddleware, EdgeInventoryController.getStock);
app.post('/api/v1/inventory/adjustment', authMiddleware, EdgeInventoryController.createAdjustment);

// Mount Local Cash Shift Reconciliation Registers
app.post('/api/v1/shifts/open', authMiddleware, ReconciliationController.openShift);
app.post('/api/v1/shifts/close', authMiddleware, ReconciliationController.closeShift);
app.get('/api/v1/shifts/current', authMiddleware, ReconciliationController.getCurrentShift);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[EDGE UNHANDLED EXCEPTION]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected edge error occurred.',
  });
});

// Initialize database and start servers
getDb().then(() => {
  app.listen(port, () => {
    console.log(`Branch Edge node active on port ${port}`);

    // Start background outbox synchronization daemon
    SyncDaemon.start();
  });
}).catch(err => {
  console.error('Failed to start Edge node database initialization:', err);
  process.exit(1);
});
