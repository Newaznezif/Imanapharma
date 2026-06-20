import { PoolClient } from 'pg';
import { transaction, query } from '../../infrastructure/db/pg-client';
import { SyncEvent } from '../../../../shared/src/types';

export class SyncOrchestrator {
  private static SUPPORTED_SCHEMA_VERSION = '1.0.0';

  /**
   * Process a single sync event from a branch.
   * Guarantees replay-safety (idempotency) and strict FIFO sequence validation.
   */
  public static async processEvent(event: Omit<SyncEvent, 'status' | 'retry_count'>): Promise<{ success: boolean; message: string }> {
    // 1. Schema version control validation
    if (event.schema_version !== this.SUPPORTED_SCHEMA_VERSION) {
      const errMsg = `Unsupported schema version: ${event.schema_version}. Expected: ${this.SUPPORTED_SCHEMA_VERSION}`;
      await this.logToDLQ(event, errMsg);
      return { success: false, message: errMsg };
    }

    // 2. Replay safety check (Check by UUID)
    const existing = await query(
      'SELECT event_uuid FROM processed_events WHERE event_uuid = $1',
      [event.event_uuid]
    );
    if (existing.length > 0) {
      return { success: true, message: `Event ${event.event_uuid} already processed (idempotent ignore)` };
    }

    // 3. FIFO Sequence Order Validation per Branch
    const lastEvent = await query(
      'SELECT MAX(sequence_number) as max_seq FROM processed_events WHERE branch_id = $1',
      [event.branch_id]
    );
    const maxSeq = lastEvent[0]?.max_seq ? parseInt(lastEvent[0].max_seq, 10) : 0;
    
    if (event.sequence_number !== maxSeq + 1) {
      const dlqCheck = await query(
        'SELECT event_uuid FROM sync_dlq WHERE branch_id = $1 AND sequence_number = $2',
        [event.branch_id, event.sequence_number]
      );
      // If it's already in the DLQ, we can skip it, otherwise we throw sequence gap error
      if (dlqCheck.length > 0) {
        return { success: true, message: `Event in DLQ, skipped` };
      }
      
      throw new Error(`FIFO Sequence Violation. Expected sequence number: ${maxSeq + 1}, got: ${event.sequence_number}`);
    }

    // 4. Run processing inside a SQL transaction
    try {
      await transaction(async (client) => {
        const payloadData = JSON.parse(event.payload);

        switch (event.entity_type) {
          case 'SALE':
            await this.processSaleEvent(client, payloadData);
            break;
          case 'STOCK_MOVEMENT':
            await this.processStockMovementEvent(client, payloadData);
            break;
          case 'TRANSFER':
            await this.processTransferEvent(client, payloadData);
            break;
          case 'AUDIT_LOG':
            await this.processAuditLogEvent(client, payloadData);
            break;
          case 'SHIFT_RECONCILIATION':
            await this.processShiftReconciliationEvent(client, payloadData);
            break;
          default:
            throw new Error(`Unknown entity type: ${event.entity_type}`);
        }

        // Record processed event to enforce idempotency constraints
        await client.query(
          `INSERT INTO processed_events (event_uuid, branch_id, sequence_number, schema_version)
           VALUES ($1, $2, $3, $4)`,
          [event.event_uuid, event.branch_id, event.sequence_number, event.schema_version]
        );
      });

      return { success: true, message: `Successfully synced event ${event.event_uuid}` };
    } catch (error: any) {
      console.error(`Sync processing error for event ${event.event_uuid}:`, error);
      const reason = error?.message || 'Unknown processing error';
      await this.logToDLQ(event, reason);
      return { success: false, message: `Processed failed and moved to DLQ: ${reason}` };
    }
  }

  /**
   * Logs a failing sync event to the Cloud DLQ table
   */
  private static async logToDLQ(event: Omit<SyncEvent, 'status' | 'retry_count'>, reason: string): Promise<void> {
    await query(
      `INSERT INTO sync_dlq (event_uuid, branch_id, sequence_number, schema_version, entity_type, payload, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_uuid) DO NOTHING`,
      [
        event.event_uuid,
        event.branch_id,
        event.sequence_number,
        event.schema_version,
        event.entity_type,
        event.payload,
        reason,
      ]
    );
  }

  private static async processSaleEvent(client: PoolClient, data: any): Promise<void> {
    // Write Sale (deduped if UUID already exists in sales table)
    await client.query(
      `INSERT INTO sales (id, branch_id, user_id, total_amount, tax_amount, discount_amount, payment_method, is_offline, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        data.id,
        data.branch_id,
        data.user_id,
        data.total_amount,
        data.tax_amount,
        data.discount_amount,
        data.payment_method,
        data.is_offline,
        data.status,
        data.created_at,
      ]
    );

    // Write Sale Items
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        await client.query(
          `INSERT INTO sale_items (id, sale_id, product_id, batch_number, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            item.id,
            item.sale_id,
            item.product_id,
            item.batch_number,
            item.quantity,
            item.unit_price,
            item.total_price,
          ]
        );
      }
    }
  }

  private static async processStockMovementEvent(client: PoolClient, data: any): Promise<void> {
    await client.query(
      `INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        data.id,
        data.product_id,
        data.branch_id,
        data.batch_number,
        data.expiry_date,
        data.quantity_change,
        data.type,
        data.user_id,
        data.reference_id,
        data.created_at,
      ]
    );
  }

  private static async processTransferEvent(client: PoolClient, data: any): Promise<void> {
    await client.query(
      `INSERT INTO transfers (id, from_branch_id, to_branch_id, status, requested_by, approved_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
       SET status = EXCLUDED.status, approved_by = EXCLUDED.approved_by, updated_at = EXCLUDED.updated_at`,
      [
        data.id,
        data.from_branch_id,
        data.to_branch_id,
        data.status,
        data.requested_by,
        data.approved_by,
        data.created_at,
        data.updated_at,
      ]
    );

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        await client.query(
          `INSERT INTO transfer_items (id, transfer_id, product_id, requested_qty, shipped_qty, received_qty)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE
           SET shipped_qty = EXCLUDED.shipped_qty, received_qty = EXCLUDED.received_qty`,
          [
            item.id,
            item.transfer_id,
            item.product_id,
            item.requested_qty,
            item.shipped_qty,
            item.received_qty,
          ]
        );
      }
    }
  }

  private static async processAuditLogEvent(client: PoolClient, data: any): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action_type, timestamp, branch_id, payload_snapshot, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        data.id,
        data.user_id,
        data.action_type,
        data.timestamp,
        data.branch_id,
        data.payload_snapshot,
        data.before_state,
        data.after_state,
      ]
    );
  }

  private static async processShiftReconciliationEvent(client: PoolClient, data: any): Promise<void> {
    // Shift logs are saved directly as audit log structures or updates to financial shifts.
    // For demo purposes, we log it to central audit logs.
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action_type, timestamp, branch_id, payload_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        data.id,
        data.user_id,
        'SHIFT_RECONCILIATION_SYNC',
        data.closed_at || new Date().toISOString(),
        data.branch_id,
        JSON.stringify(data),
      ]
    );
  }
}
