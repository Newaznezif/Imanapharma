import { dbWrite, dbRead, getNextSequenceNumber } from '../../infrastructure/db/sqlite-client';
import { SafetyValidator, SafetyValidationContext } from '../../domain/safety-validator';
import { Product, Sale, SaleItem, StockMovement, SyncEvent, AuditLog } from '../../../../shared/src/types';

export interface CheckoutPayload {
  saleId: string;
  userId: string;
  branchId: string;
  items: { productId: string; batchNumber: string; quantity: number }[];
  paymentMethod: 'CASH' | 'DIGITAL';
  taxAmount: number;
  discountAmount: number;
  prescription?: {
    patientName: string;
    doctorName: string;
    rxNumber: string;
  };
  patientAllergyFlags?: string[];
  pharmacistOverrideCredentials?: {
    username: string;
    role: string; // PHARMACIST or BRANCH_MANAGER
  };
}

export class SalesService {
  /**
   * Executes a POS checkout transaction on the local SQLite DB.
   * Serialized via the single-writer database queue.
   */
  public static async checkout(payload: CheckoutPayload): Promise<any> {
    return dbWrite(async (db) => {
      // 1. Verify Active Shift
      const activeShift = await db.get(
        'SELECT id FROM shifts WHERE user_id = ? AND status = "OPEN"',
        [payload.userId]
      );
      if (!activeShift) {
        throw new Error('Shift Required: Cashier must open a shift register before performing sales.');
      }

      // 2. Fetch products and calculate current batch balances
      const cartItems: { product: Product; quantity: number; batchNumber: string }[] = [];
      let totalAmount = 0;

      for (const item of payload.items) {
        const prodRow = await db.get('SELECT * FROM products WHERE id = ?', [item.productId]);
        if (!prodRow) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const product: Product = {
          id: prodRow.id,
          sku: prodRow.sku,
          name: prodRow.name,
          category: prodRow.category as 'Rx' | 'OTC',
          description: prodRow.description,
          created_at: prodRow.created_at,
        };

        // Query product price (we will use a static price list or mock it since prices are mock)
        // Let's assume a default unit price of $10.00 for simulation
        const unitPrice = 10.00;
        totalAmount += unitPrice * item.quantity;

        // Fetch local stock level for this product + batch
        const stockRow = await db.get(
          `SELECT SUM(quantity_change) as qty 
           FROM stock_movements 
           WHERE product_id = ? AND batch_number = ?`,
          [item.productId, item.batchNumber]
        );
        const currentStock = stockRow?.qty ? parseInt(stockRow.qty, 10) : 0;

        if (currentStock < item.quantity) {
          throw new Error(
            `Insufficient Stock: Product ${product.name} (Batch: ${item.batchNumber}) has only ${currentStock} units available, but ${item.quantity} were requested.`
          );
        }

        cartItems.push({ product, quantity: item.quantity, batchNumber: item.batchNumber });
      }

      // 3. Clinical Safety Validation
      const hasPrescription = payload.prescription !== undefined;
      const validationContext: SafetyValidationContext = {
        cart: cartItems.map(i => ({ product: i.product, quantity: i.quantity })),
        patientAllergies: payload.patientAllergyFlags,
        prescriptionValidated: hasPrescription,
      };

      const safetyResult = SafetyValidator.validate(validationContext);

      // Check blockers
      if (safetyResult.errors.length > 0) {
        // Log block event to audit logs
        const auditId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        await db.run(
          `INSERT INTO audit_logs (id, user_id, action_type, timestamp, branch_id, payload_snapshot)
           VALUES (?, 'CLINICAL_VALIDATION_BLOCK', ?, ?, ?)`,
          [auditId, payload.userId, timestamp, payload.branchId, JSON.stringify({ payload, errors: safetyResult.errors })]
        );

        // Queue blocked audit log to outbox
        const seq = await getNextSequenceNumber(db, payload.branchId);
        await db.run(
          `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
           VALUES (?, ?, ?, '1.0.0', 'AUDIT_LOG', 'CREATE', ?, ?)`,
          [
            crypto.randomUUID(),
            payload.branchId,
            seq,
            JSON.stringify({
              id: auditId,
              user_id: payload.userId,
              action_type: 'CLINICAL_VALIDATION_BLOCK',
              timestamp,
              branch_id: payload.branchId,
              payload_snapshot: JSON.stringify({ payload, errors: safetyResult.errors })
            }),
            timestamp,
          ]
        );

        throw new Error(`Clinical Safety Violation: ${safetyResult.errors.join(' | ')}`);
      }

      // Check warnings (low/medium interactions)
      let overrideLogged = false;
      if (safetyResult.warnings.length > 0) {
        if (!payload.pharmacistOverrideCredentials) {
          throw new Error(
            `Safety Warning: Clinical warnings detected (${safetyResult.warnings.join(' | ')}). A pharmacist credential override is required to finalize checkout.`
          );
        }
        overrideLogged = true;
      }

      // Start Database Writes inside transaction callbacks
      await db.run('BEGIN TRANSACTION');

      try {
        const timestamp = new Date().toISOString();
        const saleTotal = totalAmount + payload.taxAmount - payload.discountAmount;

        // A. Insert Sale
        await db.run(
          `INSERT INTO sales (id, branch_id, user_id, total_amount, tax_amount, discount_amount, payment_method, is_offline, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?)`,
          [
            payload.saleId,
            payload.branchId,
            payload.userId,
            saleTotal,
            payload.taxAmount,
            payload.discountAmount,
            payload.paymentMethod,
            timestamp,
          ]
        );

        // B. Insert Items & Decrement Inventory via Stock movements
        const saleItemsPayload: any[] = [];
        const stockMovementsPayload: any[] = [];

        for (const item of cartItems) {
          const itemId = crypto.randomUUID();
          const unitPrice = 10.00;
          const totalPrice = unitPrice * item.quantity;

          await db.run(
            `INSERT INTO sale_items (id, sale_id, product_id, batch_number, quantity, unit_price, total_price)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [itemId, payload.saleId, item.product.id, item.batchNumber, item.quantity, unitPrice, totalPrice]
          );

          saleItemsPayload.push({
            id: itemId,
            sale_id: payload.saleId,
            product_id: item.product.id,
            batch_number: item.batchNumber,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
          });

          // Insert stock movement record (STOCK_OUT event)
          const movementId = crypto.randomUUID();
          // Expiry is queried from previous ledger items
          const movementRow = await db.get(
            'SELECT expiry_date FROM stock_movements WHERE product_id = ? AND batch_number = ? LIMIT 1',
            [item.product.id, item.batchNumber]
          );
          const expiryDate = movementRow?.expiry_date || '2028-12-31';

          await db.run(
            `INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'STOCK_OUT', ?, ?, ?)`,
            [
              movementId,
              item.product.id,
              payload.branchId,
              item.batchNumber,
              expiryDate,
              -item.quantity, // Negative for stock decrement
              payload.userId,
              payload.saleId,
              timestamp,
            ]
          );

          stockMovementsPayload.push({
            id: movementId,
            product_id: item.product.id,
            branch_id: payload.branchId,
            batch_number: item.batchNumber,
            expiry_date: expiryDate,
            quantity_change: -item.quantity,
            type: 'STOCK_OUT',
            user_id: payload.userId,
            reference_id: payload.saleId,
            created_at: timestamp,
          });
        }

        // C. Log Overrides or Standard checks in local Audit Log
        const auditId = crypto.randomUUID();
        const auditAction = overrideLogged ? 'PHARMACIST_OVERRIDE_SALE' : 'STANDARD_SALE';
        const auditDetails = JSON.stringify({
          saleId: payload.saleId,
          warnings: safetyResult.warnings,
          overriddenBy: payload.pharmacistOverrideCredentials?.username,
        });

        await db.run(
          `INSERT INTO audit_logs (id, user_id, action_type, timestamp, branch_id, payload_snapshot)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [auditId, payload.userId, auditAction, timestamp, payload.branchId, auditDetails]
        );

        // D. Queue Sale creation event in SQLite sync_outbox
        const seqSale = await getNextSequenceNumber(db, payload.branchId);
        const saleSyncPayload = {
          id: payload.saleId,
          branch_id: payload.branchId,
          user_id: payload.userId,
          total_amount: saleTotal,
          tax_amount: payload.taxAmount,
          discount_amount: payload.discountAmount,
          payment_method: payload.paymentMethod,
          is_offline: true,
          status: 'COMPLETED',
          created_at: timestamp,
          items: saleItemsPayload,
        };

        await db.run(
          `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
           VALUES (?, ?, ?, '1.0.0', 'SALE', 'CREATE', ?, ?)`,
          [payload.saleId, payload.branchId, seqSale, JSON.stringify(saleSyncPayload), timestamp]
        );

        // E. Queue STOCK_OUT events in sync_outbox for central ledger alignment
        for (const mv of stockMovementsPayload) {
          const seqMv = await getNextSequenceNumber(db, payload.branchId);
          await db.run(
            `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
             VALUES (?, ?, ?, '1.0.0', 'STOCK_MOVEMENT', 'CREATE', ?, ?)`,
            [mv.id, payload.branchId, seqMv, JSON.stringify(mv), timestamp]
          );
        }

        // F. Queue Audit logs
        const seqAudit = await getNextSequenceNumber(db, payload.branchId);
        await db.run(
          `INSERT INTO sync_outbox (event_uuid, branch_id, sequence_number, schema_version, entity_type, action, payload, created_at)
           VALUES (?, ?, ?, '1.0.0', 'AUDIT_LOG', 'CREATE', ?, ?)`,
          [
            crypto.randomUUID(),
            payload.branchId,
            seqAudit,
            JSON.stringify({
              id: auditId,
              user_id: payload.userId,
              action_type: auditAction,
              timestamp,
              branch_id: payload.branchId,
              payload_snapshot: auditDetails,
            }),
            timestamp,
          ]
        );

        await db.run('COMMIT');
        return { success: true, saleId: payload.saleId, total: saleTotal };
      } catch (writeError) {
        await db.run('ROLLBACK');
        throw writeError;
      }
    });
  }
}
