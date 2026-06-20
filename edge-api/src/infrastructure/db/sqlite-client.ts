import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

let dbInstance: Database | null = null;

class DatabaseQueue {
  private queue: Promise<any> = Promise.resolve();

  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

const writeQueue = new DatabaseQueue();

/**
 * Initializes and returns the local SQLite database.
 * Activates WAL mode to optimize concurrent reads and writes.
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../../../branch-edge.db');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Activate Write-Ahead Logging (WAL) Mode
  await dbInstance.exec('PRAGMA journal_mode = WAL;');
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Create SQLite Schemas
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      discount_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      is_offline INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      event_uuid TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      sequence_number INTEGER UNIQUE, -- Assigned incrementally
      schema_version TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_retry_timestamp TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash REAL NOT NULL,
      expected_closing_cash REAL,
      physical_closing_cash REAL,
      variance REAL,
      status TEXT NOT NULL DEFAULT 'OPEN'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      payload_snapshot TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT
    );
  `);

  console.log(`Edge SQLite database initialized in WAL mode at: ${dbPath}`);

  // Seed default users if empty
  const userCount = await dbInstance.get('SELECT COUNT(*) as count FROM users');
  if (userCount?.count === 0) {
    // Seed admin, cashier and pharmacist matching seeded cloud users. Password hashes are bcrypt for 'password123'
    await dbInstance.run(`
      INSERT INTO users (id, username, password_hash, role, branch_id, created_at)
      VALUES 
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'ADMIN', '11111111-1111-1111-1111-111111111111', ?),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cashier_north', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'CASHIER', '22222222-2222-2222-2222-222222222222', ?),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pharmacist_north', '$2a$10$BU2OEFecUQxl7VpoByJXcuAO2q0GtuKAxlRmeYT/hUv2XJ0VkAegO', 'PHARMACIST', '22222222-2222-2222-2222-222222222222', ?)
    `, [new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]);
    console.log('Seeded offline users.');
  }

  // Seed default products if empty
  const productCount = await dbInstance.get('SELECT COUNT(*) as count FROM products');
  if (productCount?.count === 0) {
    await dbInstance.run(`
      INSERT INTO products (id, sku, name, category, description, created_at)
      VALUES
      ('d1111111-1111-1111-1111-111111111111', 'WARF', 'Warfarin 5mg Tablets', 'Rx', 'Oral anticoagulant (blood thinner). Requires pharmacist prescription validation.', ?),
      ('d2222222-2222-2222-2222-222222222222', 'ASPIRIN', 'Aspirin 81mg Chewable', 'OTC', 'Low-dose acetylsalicylic acid for cardiac therapy. OTC.', ?),
      ('d3333333-3333-3333-3333-333333333333', 'ERYTHR', 'Erythromycin 250mg Tablets', 'Rx', 'Macrolide antibiotic. Rx.', ?),
      ('d4444444-4444-4444-4444-444444444444', 'SIMVA', 'Simvastatin 20mg Tablets', 'Rx', 'HMG-CoA reductase inhibitor (statin) for hypercholesterolemia. Rx.', ?),
      ('d5555555-5555-5555-5555-555555555555', 'ATORV', 'Atorvastatin 10mg Tablets', 'Rx', 'Statins for lipid reduction. Rx.', ?),
      ('d6666666-6666-6666-6666-666666666666', 'IBUPROFEN', 'Ibuprofen 200mg Tablets', 'OTC', 'Nonsteroidal anti-inflammatory drug (NSAID). OTC.', ?)
    `, [
      new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), 
      new Date().toISOString(), new Date().toISOString(), new Date().toISOString()
    ]);
    console.log('Seeded offline products.');

    // Seed some initial inventory ledger events (e.g. 50 units of everything in North branch)
    await dbInstance.run(`
      INSERT INTO stock_movements (id, product_id, branch_id, batch_number, expiry_date, quantity_change, type, user_id, reference_id, created_at)
      VALUES
      (?, 'd1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'B-WARF-02', '2028-12-31', 50, 'STOCK_IN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'init_ref', ?),
      (?, 'd2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'B-ASPI-02', '2027-06-30', 100, 'STOCK_IN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'init_ref', ?),
      (?, 'd3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'B-ERYT-02', '2027-10-31', 40, 'STOCK_IN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'init_ref', ?),
      (?, 'd4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'B-SIMV-02', '2027-08-31', 60, 'STOCK_IN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'init_ref', ?)
    `, [
      crypto.randomUUID(), new Date().toISOString(),
      crypto.randomUUID(), new Date().toISOString(),
      crypto.randomUUID(), new Date().toISOString(),
      crypto.randomUUID(), new Date().toISOString()
    ]);
    console.log('Seeded offline branch stock ledger.');
  }

  return dbInstance;
}

/**
 * Execute a read operation directly (allows parallelism in WAL mode)
 */
export async function dbRead<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const db = await getDb();
  return operation(db);
}

/**
 * Execute a write operation serialized through the single-writer write queue.
 * Guarantees no SQLITE_BUSY write lock conflicts.
 */
export async function dbWrite<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const db = await getDb();
  return writeQueue.enqueue(() => operation(db));
}

/**
 * Helper to generate next branch sequence number.
 */
export async function getNextSequenceNumber(db: Database, branchId: string): Promise<number> {
  const row = await db.get(
    'SELECT MAX(sequence_number) as max_seq FROM sync_outbox WHERE branch_id = ?',
    [branchId]
  );
  return (row?.max_seq ? parseInt(row.max_seq, 10) : 0) + 1;
}
