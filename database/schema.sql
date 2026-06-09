-- VenuePOS Multi-Tenant Schema
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS venuepos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE venuepos;

-- ─── Companies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  business_type ENUM('bar', 'restaurant', 'club', 'multi') DEFAULT 'multi',
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  country VARCHAR(100) DEFAULT 'ZW',
  currency VARCHAR(3) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'Africa/Harare',
  logo_url VARCHAR(500),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  warehouse_mode ENUM('central', 'per_branch') NOT NULL DEFAULT 'central',
  stock_variance_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  yoco_public_key VARCHAR(255),
  yoco_secret_key VARCHAR(255),
  yoco_webhook_secret VARCHAR(255),
  receipt_footer TEXT,
  status ENUM('active', 'suspended', 'trial') DEFAULT 'trial',
  subscription_plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
  trial_ends_at DATETIME DEFAULT (DATE_ADD(NOW(), INTERVAL 30 DAY)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Branches ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  branch_type ENUM('bar', 'restaurant', 'club', 'lounge') DEFAULT 'bar',
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  timezone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  opening_time TIME DEFAULT '08:00:00',
  closing_time TIME DEFAULT '02:00:00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_slug (company_id, slug),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  avatar_url VARCHAR(500),
  company_role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP NULL,
  pin_code VARCHAR(6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_email (company_id, email),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ─── Branch access ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_branch_access (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  branch_id INT NOT NULL,
  role ENUM('manager', 'supervisor', 'cashier', 'bartender', 'server', 'kitchen', 'host') NOT NULL,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_branch (user_id, branch_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- ─── Employees ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  branch_id INT,
  user_id INT,
  employee_code VARCHAR(20),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  phone VARCHAR(50),
  pin_code VARCHAR(6),
  hire_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Restaurant tables ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_tables (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  table_number VARCHAR(20) NOT NULL,
  label VARCHAR(100),
  capacity INT DEFAULT 4,
  zone VARCHAR(50) DEFAULT 'main',
  status ENUM('available', 'occupied', 'reserved', 'dirty') DEFAULT 'available',
  pos_x INT DEFAULT 0,
  pos_y INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_table (branch_id, table_number),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- ─── Bar tabs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tabs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  tab_name VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255),
  table_id INT,
  employee_id INT,
  user_id INT,
  status ENUM('open', 'closed', 'voided') DEFAULT 'open',
  subtotal DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES venue_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Products & inventory ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(50),
  category VARCHAR(100),
  buying_price DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL,
  units_per_case INT DEFAULT 1,
  send_to_kitchen BOOLEAN DEFAULT FALSE,
  audit_on_shift_close BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branch_stock (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  product_id INT NOT NULL,
  units_available INT DEFAULT 0,
  reorder_level INT DEFAULT 10,
  UNIQUE KEY uq_branch_product (branch_id, product_id),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warehouse_stock (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  branch_id INT NULL,
  product_id INT NOT NULL,
  cases_available INT DEFAULT 0,
  UNIQUE KEY uq_warehouse_stock (company_id, branch_id, product_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─── Shifts ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  user_id INT,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  opening_cash DECIMAL(10,2) DEFAULT 0,
  closing_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  mobile_sales DECIMAL(10,2) DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  variance DECIMAL(10,2),
  stock_audit_status ENUM('pending', 'submitted', 'flagged', 'approved') NOT NULL DEFAULT 'pending',
  stock_variance_total INT NOT NULL DEFAULT 0,
  stock_audit_notes TEXT,
  status ENUM('open', 'closed') DEFAULT 'open',
  notes TEXT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Orders ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  branch_id INT NOT NULL,
  shift_id INT,
  order_number VARCHAR(30) NOT NULL,
  employee_id INT,
  user_id INT,
  table_id INT,
  tab_id INT,
  status ENUM('open', 'completed', 'voided', 'refunded') DEFAULT 'open',
  kitchen_status ENUM('none', 'pending', 'in_progress', 'ready', 'served') DEFAULT 'none',
  order_type ENUM('dine_in', 'takeaway', 'bar_tab', 'delivery') DEFAULT 'bar_tab',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  payment_method ENUM('cash', 'card', 'mobile', 'split', 'tab', 'yoco') DEFAULT 'cash',
  payment_status ENUM('pending', 'paid', 'partial', 'refunded') DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (table_id) REFERENCES venue_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  kitchen_status ENUM('none', 'pending', 'preparing', 'ready', 'served') DEFAULT 'none',
  notes VARCHAR(255),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ─── Payments ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('cash', 'card', 'mobile', 'yoco', 'tab') NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  yoco_token VARCHAR(255),
  yoco_charge_id VARCHAR(255),
  reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  branch_id INT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  expense_type ENUM('fixed', 'variable', 'payroll') NOT NULL DEFAULT 'variable',
  recorded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

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

-- ─── Audit log ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_venue_tables_branch ON venue_tables(branch_id);
CREATE INDEX idx_tabs_branch ON tabs(branch_id, status);
CREATE INDEX idx_orders_branch ON orders(branch_id, created_at);
CREATE INDEX idx_orders_kitchen ON orders(branch_id, kitchen_status);
CREATE INDEX idx_order_items_kitchen ON order_items(kitchen_status);
CREATE INDEX idx_shifts_branch ON shifts(branch_id, status);
CREATE INDEX idx_payments_order ON payments(order_id);
