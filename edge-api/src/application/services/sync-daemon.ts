import fetch from 'node-fetch';
import { dbWrite, dbRead } from '../../infrastructure/db/sqlite-client';

export class SyncDaemon {
  private static isRunning = false;
  private static cloudBaseUrl = process.env.CLOUD_API_URL || 'http://localhost:5000';
  private static branchId = process.env.BRANCH_ID || '22222222-2222-2222-2222-222222222222';
  private static token: string | null = null;
  private static checkIntervalMs = 5000;
  private static backoffMultiplierMs = 1000;
  private static maxBackoffMs = 60000; // Max 1 minute delay

  /**
   * Starts the sync background loop.
   */
  public static start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    console.log(`[Sync Daemon] Started sync service for branch ${this.branchId}`);
    this.loop();
  }

  /**
   * Main sync loop execution wrapper.
   */
  private static async loop(): Promise<void> {
    let nextDelay = this.checkIntervalMs;

    try {
      const processed = await this.syncNextEvent();
      if (processed) {
        // If we synced an event, run again immediately to empty the queue
        nextDelay = 500;
      }
    } catch (err: any) {
      console.error('[Sync Daemon Error] Error during synchronization tick:', err.message);
      // If network or other error, calculate exponential backoff from current retry counts
      nextDelay = this.checkIntervalMs;
    }

    setTimeout(() => this.loop(), nextDelay);
  }

  /**
   * Authenticates with Cloud API to obtain sync token.
   */
  private static async ensureToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    try {
      const res = await fetch(`${this.cloudBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin', // System sync user seeded in cloud DB
          password: 'password123'
        })
      });

      if (!res.ok) {
        throw new Error(`Cloud auth failed: ${res.statusText}`);
      }

      const data = await res.json() as { accessToken: string };
      this.token = data.accessToken;
      return this.token!;
    } catch (err: any) {
      console.error('[Sync Daemon Token Failure] Could not connect to Cloud API to authenticate:', err.message);
      throw err;
    }
  }

  /**
   * Fetches the next PENDING outbox item and posts it to the Cloud.
   * Enforces strict FIFO by only fetching the lowest sequence_number.
   */
  private static async syncNextEvent(): Promise<boolean> {
    // 1. Get next pending event in FIFO sequence (lowest sequence number)
    const event = await dbRead(async (db) => {
      return db.get(
        `SELECT * FROM sync_outbox 
         WHERE status = 'PENDING' 
         ORDER BY sequence_number ASC 
         LIMIT 1`
      );
    });

    if (!event) {
      return false; // No events to sync
    }

    // Calculate dynamic backoff if the event has failed multiple times
    const lastRetry = event.last_retry_timestamp ? new Date(event.last_retry_timestamp).getTime() : 0;
    const now = Date.now();
    const backoffDelay = Math.min(
      Math.pow(2, event.retry_count) * this.backoffMultiplierMs,
      this.maxBackoffMs
    );

    if (event.retry_count > 0 && now - lastRetry < backoffDelay) {
      // Waiting for backoff timer to expire for this event
      return false;
    }

    console.log(`[Sync Daemon] Syncing event seq=${event.sequence_number} uuid=${event.event_uuid} ...`);

    try {
      const token = await this.ensureToken();

      const res = await fetch(`${this.cloudBaseUrl}/api/v1/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': event.event_uuid, // Send UUID as idempotency check
        },
        body: JSON.stringify({
          event_uuid: event.event_uuid,
          branch_id: event.branch_id,
          sequence_number: event.sequence_number,
          schema_version: event.schema_version,
          entity_type: event.entity_type,
          payload: event.payload
        })
      });

      // Handle 401 Unauthorized - Token might be expired, clear it so we re-auth next run
      if (res.status === 401) {
        console.warn('[Sync Daemon] Token expired or unauthorized. Clearing JWT cache.');
        this.token = null;
        throw new Error('Authentication required');
      }

      // Handle 409 Sequence Conflict (Cloud expected a different sequence number)
      if (res.status === 409) {
        const errorData = await res.json() as { message: string };
        console.warn(`[Sync Daemon Sequence Conflict] ${errorData.message}`);
        
        // Update retry parameters but do NOT skip. Let next tick retry.
        await dbWrite(async (db) => {
          await db.run(
            `UPDATE sync_outbox 
             SET retry_count = retry_count + 1, last_retry_timestamp = ?, failure_reason = ?
             WHERE event_uuid = ?`,
            [new Date().toISOString(), errorData.message || 'Sequence gap', event.event_uuid]
          );
        });
        return false;
      }

      // Handle success (200 SYNCED or 202 DLQ_ARCHIVED)
      if (res.status === 200 || res.status === 202) {
        const result = await res.json() as { message: string; status?: string };
        console.log(`[Sync Daemon Success] Cloud response: ${result.message}`);

        await dbWrite(async (db) => {
          // A. Mark event as SYNCED
          await db.run(
            `UPDATE sync_outbox SET status = 'SYNCED' WHERE event_uuid = ?`,
            [event.event_uuid]
          );

          // B. If it was a sale, we can update local sale status
          if (event.entity_type === 'SALE') {
            await db.run(
              `UPDATE sales SET status = 'SYNCED' WHERE id = ?`,
              [event.entity_id]
            );
          }
        });

        return true;
      }

      // Handle other server errors (e.g. 500)
      const errText = await res.text();
      throw new Error(`Cloud server returned status ${res.status}: ${errText.slice(0, 100)}`);

    } catch (err: any) {
      console.warn(`[Sync Daemon Warning] Sync failed for event uuid=${event.event_uuid}: ${err.message}`);
      
      // Update retry count and backoff parameters
      await dbWrite(async (db) => {
        await db.run(
          `UPDATE sync_outbox 
           SET retry_count = retry_count + 1, last_retry_timestamp = ?, failure_reason = ?
           WHERE event_uuid = ?`,
          [new Date().toISOString(), err.message, event.event_uuid]
        );
      });
      return false;
    }
  }
}
