import express from 'express';
import path from 'path';
import { config } from './config';
import { authMiddleware, requireRole, requirePasswordChangeComplete } from './middleware/auth';
import cookieParser from 'cookie-parser';
import { helmetMiddleware, corsMiddleware, authRateLimiter, apiRateLimiter, sanitizeBody, requestId, csrfMiddleware } from './middleware/security';

import { AuthController } from './controllers/auth.controller';
import { MedicineController } from './controllers/medicine.controller';
import { PatientController } from './controllers/patient.controller';
import { OrderController } from './controllers/order.controller';
import { ReportController } from './controllers/report.controller';
import { SettingController, logoUpload } from './controllers/setting.controller';
import { SupplierController } from './controllers/supplier.controller';
import { DoctorController } from './controllers/doctor.controller';
import { AdminController } from './controllers/admin.controller';

const app = express();

// Enable trust proxy if behind a reverse proxy (needed for accurate IP rate limiting)
app.set('trust proxy', 1);

// ── Security Middlewares ─────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use(requestId);
app.use('/api/', apiRateLimiter);
app.use('/api/', csrfMiddleware);

// ── Static Files ─────────────────────────────────────────────────────────────
// Serve uploads folder as static files
// Serve uploads folder with explicit CORS headers so the frontend (port 3000) can load images
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../../uploads')));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

// ── Settings API (Public read, Manager edit) ─────────────────────────────────
app.get('/api/v1/settings', SettingController.getSettings);
app.put('/api/v1/settings', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SettingController.updateSettings);
app.post('/api/v1/settings/logo', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), logoUpload.single('logo'), SettingController.uploadLogo);

// ── Authentication & Users ───────────────────────────────────────────────────
app.post('/api/v1/auth/login', authRateLimiter, AuthController.login);
app.post('/api/v1/auth/logout', authMiddleware, AuthController.logout);

// Self-service (Any authenticated user)
app.get('/api/v1/auth/me', authMiddleware, AuthController.getMe);
app.post('/api/v1/auth/change-password', authRateLimiter, authMiddleware, AuthController.changePassword);

// Manager admin operations
app.get('/api/v1/auth/users', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.getUsers);
app.post('/api/v1/auth/users', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.createUser);
app.put('/api/v1/auth/users/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.updateUser);
app.post('/api/v1/auth/users/:id/reset-password', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.resetPassword);
app.post('/api/v1/auth/users/:id/unlock', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.unlockUser);
app.delete('/api/v1/auth/users/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AuthController.deleteUser);

// ── Medicines (Manager & Pharmacist) ─────────────────────────────────────────
app.get('/api/v1/medicines', authMiddleware, requirePasswordChangeComplete, MedicineController.getMedicines);
app.get('/api/v1/medicines/alerts', authMiddleware, requirePasswordChangeComplete, MedicineController.getInventoryAlerts);
app.post('/api/v1/medicines', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), MedicineController.createMedicine);
app.post('/api/v1/medicines/adjust', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), MedicineController.adjustStock);
app.put('/api/v1/medicines/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), MedicineController.updateMedicine);
app.delete('/api/v1/medicines/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), MedicineController.deleteMedicine);

// ── Patients (Manager & Pharmacist) ──────────────────────────────────────────
app.get('/api/v1/patients', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), PatientController.getPatients);
app.post('/api/v1/patients', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), PatientController.createPatient);
app.put('/api/v1/patients/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), PatientController.updatePatient);
app.get('/api/v1/patients/:id/history', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), PatientController.getPatientHistory);

// ── Doctors (Manager & Pharmacist) ───────────────────────────────────────────
app.get('/api/v1/doctors', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), DoctorController.getDoctors);
app.post('/api/v1/doctors', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), DoctorController.createDoctor);

// ── Orders (Pharmacist creates, Cashier checkout, Manager cancels) ───────────
app.get('/api/v1/orders', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), OrderController.getOrders);
app.get('/api/v1/orders/pending', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), OrderController.getPendingOrders);
app.post('/api/v1/orders/:id/checkout', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), OrderController.checkoutOrder);
app.post('/api/v1/orders/:id/return', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER', 'PHARMACIST']), OrderController.returnOrder);
app.delete('/api/v1/orders/:id', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), OrderController.cancelOrder);

// ── Reports & Dashboard (Manager only) ─────────────────────────────────────
app.get('/api/v1/reports/dashboard-overview', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.getDashboardOverview);
app.get('/api/v1/reports/sales-history', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.getSalesHistory);
app.get('/api/v1/reports/charts', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.getChartsData);
app.get('/api/v1/reports/audit-logs', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.getAuditLogs);
app.get('/api/v1/reports/export/csv', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.exportCSV);
app.get('/api/v1/reports/export/excel', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), ReportController.exportExcel);

// ── Database Backup & Restore (Manager only) ──────────────────────────────────
app.get('/api/v1/admin/backup', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AdminController.backupDatabase);
app.post('/api/v1/admin/restore', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), AdminController.restoreDatabase);

// ── Suppliers & Purchase Orders (Manager only) ────────────────────────────────
app.get('/api/v1/suppliers', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SupplierController.getSuppliers);
app.post('/api/v1/suppliers', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SupplierController.createSupplier);
app.get('/api/v1/purchase-orders', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SupplierController.getPurchaseOrders);
app.post('/api/v1/purchase-orders', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SupplierController.createPurchaseOrder);
app.post('/api/v1/purchase-orders/:id/receive', authMiddleware, requirePasswordChangeComplete, requireRole(['MANAGER']), SupplierController.receivePurchaseOrder);

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const reqId = (req as any).requestId;
  console.error(`[UNHANDLED ERROR][${reqId}]`, err);

  // Security: Never leak full error stack/messages to client in production
  if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid JSON payload' });
  }

  res.status(err.status || 500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred.',
    referenceId: reqId
  });
});

// ── Process-level Error Handling ─────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In a real production environment, you might want to exit and let PM2/Docker restart
  // process.exit(1);
});

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`ImanaPharma Monolithic Backend listening on port ${config.port} in ${config.nodeEnv} mode`);
});
