import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './src/config';

async function runMigration() {
  const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected. Running migration script...');

    const migrations = [
      '001_enterprise_upgrade.sql',
      '002_final_enterprise.sql',
      '003_auth_security.sql',
      '004_inventory_fefo.sql',
      '005_patients_prescriptions.sql',
      '006_pos_supplier_finance.sql',
      '007_controlled_substances.sql'
    ];

    for (const file of migrations) {
      console.log(`Running migration: ${file}...`);
      const migrationPath = path.join(__dirname, `../database/migrations/${file}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`${file} executed successfully.`);
    }

    const seedPath = path.join(__dirname, '../database/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    
    console.log('Running updated seed script to re-seed data securely...');
    await client.query(seedSql);
    console.log('Seed script executed successfully.');

    client.release();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
