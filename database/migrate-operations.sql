-- Operations migration — applied via: npm run db:migrate
-- (Idempotent Node script: scripts/migrate.mjs)
-- This file is kept for reference; do not pipe directly if already migrated.

USE venuepos;

ALTER TABLE companies
  ADD COLUMN warehouse_mode ENUM('central', 'per_branch') NOT NULL DEFAULT 'central',
  ADD COLUMN stock_variance_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.00;

ALTER TABLE products
  ADD COLUMN audit_on_shift_close BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE warehouse_stock
  ADD COLUMN branch_id INT NULL AFTER company_id;

ALTER TABLE expenses
  ADD COLUMN company_id INT NULL AFTER id,
  ADD COLUMN expense_type ENUM('fixed', 'variable', 'payroll') NOT NULL DEFAULT 'variable';

UPDATE expenses e
JOIN branches b ON b.id = e.branch_id
SET e.company_id = b.company_id
WHERE e.company_id IS NULL;

ALTER TABLE expenses MODIFY branch_id INT NULL;

ALTER TABLE shifts
  ADD COLUMN stock_audit_status ENUM('pending', 'submitted', 'flagged', 'approved') NOT NULL DEFAULT 'pending',
  ADD COLUMN stock_variance_total INT NOT NULL DEFAULT 0,
  ADD COLUMN stock_audit_notes TEXT NULL;

CREATE TABLE IF NOT EXISTS stock_movements (
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
);

CREATE TABLE IF NOT EXISTS shift_stock_counts (
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
);
