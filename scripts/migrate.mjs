#!/usr/bin/env node
/**
 * Idempotent database migrations — safe to run multiple times.
 * Usage: npm run db:migrate
 */
import 'dotenv/config'
import db from '../db.js'

async function columnExists(table, column) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  return row.c > 0
}

async function tableExists(table) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  )
  return row.c > 0
}

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function isMigrationApplied(id) {
  const [[row]] = await db.query('SELECT id FROM schema_migrations WHERE id = ?', [id])
  return !!row
}

async function markMigrationApplied(id) {
  await db.query('INSERT IGNORE INTO schema_migrations (id) VALUES (?)', [id])
}

async function migrateOperations() {
  const id = 'operations-v1'
  if (await isMigrationApplied(id)) {
    console.log(`  ${id} already recorded — re-checking schema...`)
  }

  if (!(await columnExists('companies', 'warehouse_mode'))) {
    await db.query(`
      ALTER TABLE companies
        ADD COLUMN warehouse_mode ENUM('central', 'per_branch') NOT NULL DEFAULT 'central',
        ADD COLUMN stock_variance_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.00
    `)
    console.log('  + companies.warehouse_mode, stock_variance_threshold')
  }

  if (!(await columnExists('products', 'audit_on_shift_close'))) {
    await db.query(`
      ALTER TABLE products
        ADD COLUMN audit_on_shift_close BOOLEAN NOT NULL DEFAULT TRUE
    `)
    console.log('  + products.audit_on_shift_close')
  }

  if (!(await columnExists('warehouse_stock', 'branch_id'))) {
    await db.query(`ALTER TABLE warehouse_stock ADD COLUMN branch_id INT NULL AFTER company_id`)
    console.log('  + warehouse_stock.branch_id')
  }

  if (!(await columnExists('expenses', 'company_id'))) {
    await db.query(`
      ALTER TABLE expenses
        ADD COLUMN company_id INT NULL AFTER id,
        ADD COLUMN expense_type ENUM('fixed', 'variable', 'payroll') NOT NULL DEFAULT 'variable'
    `)
    console.log('  + expenses.company_id, expense_type')
  }

  await db.query(`
    UPDATE expenses e
    JOIN branches b ON b.id = e.branch_id
    SET e.company_id = b.company_id
    WHERE e.company_id IS NULL AND e.branch_id IS NOT NULL
  `)

  if (!(await columnExists('shifts', 'stock_audit_status'))) {
    await db.query(`
      ALTER TABLE shifts
        ADD COLUMN stock_audit_status ENUM('pending', 'submitted', 'flagged', 'approved') NOT NULL DEFAULT 'pending',
        ADD COLUMN stock_variance_total INT NOT NULL DEFAULT 0,
        ADD COLUMN stock_audit_notes TEXT NULL
    `)
    console.log('  + shifts stock audit columns')
  }

  if (!(await tableExists('stock_movements'))) {
    await db.query(`
      CREATE TABLE stock_movements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        branch_id INT NULL,
        product_id INT NOT NULL,
        movement_type ENUM('opening', 'sale', 'transfer_in', 'transfer_out', 'wastage', 'adjustment', 'shift_count') NOT NULL,
        quantity INT NOT NULL,
        reference_type VARCHAR(50),
        reference_id INT,
        shift_id INT NULL,
        user_id INT NULL,
        notes VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_stock_movements_branch (branch_id, created_at),
        INDEX idx_stock_movements_shift (shift_id)
      )
    `)
    console.log('  + stock_movements table')
  }

  if (!(await tableExists('shift_stock_counts'))) {
    await db.query(`
      CREATE TABLE shift_stock_counts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        shift_id INT NOT NULL,
        product_id INT NOT NULL,
        opening_qty INT NOT NULL DEFAULT 0,
        sold_qty INT NOT NULL DEFAULT 0,
        expected_qty INT NOT NULL DEFAULT 0,
        counted_qty INT NULL,
        variance INT NULL,
        UNIQUE KEY uq_shift_product (shift_id, product_id),
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    console.log('  + shift_stock_counts table')
  }

  await markMigrationApplied(id)
}

async function main() {
  console.log('Running database migrations...')
  await ensureMigrationsTable()
  await migrateOperations()
  console.log('Migrations complete.')
  await db.end()
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
