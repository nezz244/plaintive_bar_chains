#!/usr/bin/env node
/**
 * Seed sample products, staff, tables, tabs, and demo orders for an existing account.
 * Usage: npm run db:seed
 *        npm run db:seed -- --email=you@example.com
 */
import 'dotenv/config'
import db from '../db.js'

const email = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1]
  || process.env.SEED_EMAIL
  || 'tnesara55@gmail.com'

const PRODUCTS = [
  { sku: 'BEER-CST', name: 'Castle Lager', category: 'Beer', buying: 1.2, selling: 3.5, stock: 120, kitchen: false },
  { sku: 'BEER-SAV', name: 'Savanna Dry', category: 'Beer', buying: 1.5, selling: 4.0, stock: 80, kitchen: false },
  { sku: 'SPIR-JD', name: 'Jack Daniels (single)', category: 'Spirits', buying: 2.0, selling: 6.0, stock: 48, kitchen: false },
  { sku: 'COCK-GT', name: 'Gin & Tonic', category: 'Cocktails', buying: 1.8, selling: 5.5, stock: 60, kitchen: false },
  { sku: 'SOFT-COL', name: 'Coca-Cola', category: 'Soft Drinks', buying: 0.6, selling: 2.0, stock: 100, kitchen: false },
  { sku: 'FOOD-BRG', name: 'Classic Burger', category: 'Food', buying: 3.5, selling: 9.0, stock: 40, kitchen: true },
  { sku: 'FOOD-WNG', name: 'Buffalo Wings', category: 'Food', buying: 4.0, selling: 10.0, stock: 35, kitchen: true },
  { sku: 'FOOD-CHP', name: 'Loaded Fries', category: 'Food', buying: 2.0, selling: 6.5, stock: 50, kitchen: true },
  { sku: 'HOT-COF', name: 'Espresso', category: 'Hot Drinks', buying: 0.8, selling: 3.0, stock: 200, kitchen: false },
]

const EMPLOYEES = [
  { code: 'EMP001', first: 'Tendai', last: 'Moyo', role: 'bartender', pin: '1234' },
  { code: 'EMP002', first: 'Rudo', last: 'Chikwanha', role: 'manager', pin: '5678' },
  { code: 'EMP003', first: 'Kuda', last: 'Ncube', role: 'server', pin: '9012' },
]

const TABLES = [
  { number: '1', label: 'Window Booth', capacity: 4, zone: 'main', status: 'available', x: 0, y: 0 },
  { number: '2', label: 'Corner Table', capacity: 4, zone: 'main', status: 'occupied', x: 120, y: 0 },
  { number: '3', label: 'Bar High Top', capacity: 2, zone: 'bar', status: 'available', x: 240, y: 0 },
  { number: '4', label: 'Pool Side', capacity: 6, zone: 'main', status: 'available', x: 0, y: 100 },
  { number: '5', label: 'Stage View', capacity: 4, zone: 'main', status: 'reserved', x: 120, y: 100 },
  { number: 'VIP-1', label: 'VIP Booth A', capacity: 8, zone: 'vip', status: 'available', x: 0, y: 200 },
  { number: 'VIP-2', label: 'VIP Booth B', capacity: 8, zone: 'vip', status: 'available', x: 120, y: 200 },
]

async function findAccount() {
  const [users] = await db.query(
    `SELECT u.id AS user_id, u.company_id, c.name AS company_name
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.email = ? AND u.is_active = TRUE`,
    [email]
  )
  if (!users.length) {
    throw new Error(`No active user found for email: ${email}`)
  }
  return users[0]
}

async function findPrimaryBranch(companyId, userId) {
  const [branches] = await db.query(
    `SELECT b.id, b.name FROM branches b
     LEFT JOIN user_branch_access uba ON uba.branch_id = b.id AND uba.user_id = ?
     WHERE b.company_id = ? AND b.is_active = TRUE
     ORDER BY uba.id IS NOT NULL DESC, b.id ASC LIMIT 1`,
    [userId, companyId]
  )
  if (!branches.length) {
    throw new Error(`No branch found for company ${companyId}. Create a branch first.`)
  }
  return branches[0]
}

async function seedProducts(companyId, branchId) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM products WHERE company_id = ?',
    [companyId]
  )
  if (count > 0) {
    console.log(`  Products already exist (${count}) — skipping`)
    const [rows] = await db.query(
      'SELECT id, sku, selling_price AS selling FROM products WHERE company_id = ?',
      [companyId]
    )
    return rows
  }

  const inserted = []
  for (const p of PRODUCTS) {
    const [result] = await db.query(
      `INSERT INTO products (company_id, name, sku, category, buying_price, selling_price, send_to_kitchen)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, p.name, p.sku, p.category, p.buying, p.selling, p.kitchen]
    )
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, units_available, reorder_level)
       VALUES (?, ?, ?, 10)`,
      [branchId, result.insertId, p.stock]
    )
    await db.query(
      `INSERT INTO warehouse_stock (company_id, product_id, cases_available)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cases_available = cases_available + VALUES(cases_available)`,
      [companyId, result.insertId, Math.ceil(p.stock / 24)]
    )
    inserted.push({ id: result.insertId, sku: p.sku, ...p })
  }
  console.log(`  Added ${inserted.length} products with branch stock`)
  return inserted
}

async function seedEmployees(companyId, branchId) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM employees WHERE company_id = ? AND branch_id = ?',
    [companyId, branchId]
  )
  if (count > 0) {
    console.log(`  Employees already exist (${count}) — skipping`)
    const [rows] = await db.query(
      'SELECT id, employee_code FROM employees WHERE company_id = ? AND branch_id = ?',
      [companyId, branchId]
    )
    return rows
  }

  const inserted = []
  for (const e of EMPLOYEES) {
    const [result] = await db.query(
      `INSERT INTO employees (company_id, branch_id, employee_code, first_name, last_name, role, pin_code, hire_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), TRUE)`,
      [companyId, branchId, e.code, e.first, e.last, e.role, e.pin]
    )
    inserted.push({ id: result.insertId, ...e })
  }
  console.log(`  Added ${inserted.length} employees`)
  return inserted
}

async function seedTables(branchId) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM venue_tables WHERE branch_id = ?',
    [branchId]
  )
  if (count > 0) {
    console.log(`  Tables already exist (${count}) — skipping`)
    const [rows] = await db.query(
      'SELECT id, table_number FROM venue_tables WHERE branch_id = ? ORDER BY id',
      [branchId]
    )
    return rows
  }

  const inserted = []
  for (const t of TABLES) {
    const [result] = await db.query(
      `INSERT INTO venue_tables (branch_id, table_number, label, capacity, zone, status, pos_x, pos_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [branchId, t.number, t.label, t.capacity, t.zone, t.status, t.x, t.y]
    )
    inserted.push({ id: result.insertId, ...t })
  }
  console.log(`  Added ${inserted.length} tables`)
  return inserted
}

async function seedTabsAndOrders(companyId, branchId, userId, products, tables, employees) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM tabs WHERE branch_id = ?',
    [branchId]
  )
  if (count > 0) {
    console.log(`  Tabs/orders already exist — skipping demo orders`)
    return
  }

  const productBySku = Object.fromEntries(products.map((p) => [p.sku, p]))
  const table2 = tables.find((t) => t.number === '2') || tables[1]

  const [tabResult] = await db.query(
    `INSERT INTO tabs (branch_id, tab_name, customer_name, table_id, employee_id, user_id, status, subtotal, total_amount)
     VALUES (?, 'Tab — John M.', 'John M.', ?, ?, ?, 'open', 17.50, 17.50)`,
    [branchId, table2?.id || null, employees[0]?.id || null, userId]
  )
  const tabId = tabResult.insertId

  const [tab2Result] = await db.query(
    `INSERT INTO tabs (branch_id, tab_name, customer_name, employee_id, status, subtotal, total_amount)
     VALUES (?, 'Walk-in Bar', 'Walk-in', ?, 'open', 9.50, 9.50)`,
    [branchId, employees[0]?.id || null]
  )

  const orderNumber = `ORD-DEMO-${Date.now().toString(36).toUpperCase()}`
  const burger = productBySku['FOOD-BRG']
  const lager = productBySku['BEER-CST']

  const [orderResult] = await db.query(
    `INSERT INTO orders (company_id, branch_id, order_number, employee_id, user_id, table_id, tab_id,
                         status, kitchen_status, order_type, subtotal, total_amount,
                         payment_method, payment_status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 'served', 'bar_tab', 17.50, 17.50, 'cash', 'paid', NOW())`,
    [companyId, branchId, orderNumber, employees[0]?.id, userId, table2?.id, tabId]
  )
  const orderId = orderResult.insertId

  if (burger && lager) {
    await db.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, kitchen_status)
       VALUES (?, ?, 2, ?, ?, 'served'), (?, ?, 1, ?, ?, 'none')`,
      [orderId, lager.id, lager.selling, lager.selling * 2, orderId, burger.id, burger.selling, burger.selling]
    )
    await db.query(
      'UPDATE branch_stock SET units_available = units_available - 2 WHERE branch_id = ? AND product_id = ?',
      [branchId, lager.id]
    )
    await db.query(
      'UPDATE branch_stock SET units_available = units_available - 1 WHERE branch_id = ? AND product_id = ?',
      [branchId, burger.id]
    )
  }

  await db.query(
    `INSERT INTO payments (order_id, amount, method, status) VALUES (?, 17.50, 'cash', 'completed')`,
    [orderId]
  )

  const closedAt = new Date()
  closedAt.setDate(closedAt.getDate() - 1)
  await db.query(
    `INSERT INTO shifts (branch_id, employee_id, user_id, start_time, end_time, opening_cash, closing_cash,
                         expected_cash, cash_sales, total_sales, status, notes)
     VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 16 HOUR),
             100, 117.50, 117.50, 17.50, 17.50, 'closed', 'Sample closed shift from seed data')`,
    [branchId, employees[1]?.id || employees[0]?.id, userId]
  )

  console.log(`  Added 2 open tabs, 1 completed order, 1 closed shift`)
  void tab2Result
}

async function seedCompanySettings(companyId) {
  await db.query(
    `UPDATE companies SET
       tax_rate = 15,
       receipt_footer = 'Thank you for visiting Plaintive Casino!\\nPlumtree — Where the night comes alive.',
       currency = 'USD',
       warehouse_mode = 'central',
       stock_variance_threshold = 5
     WHERE id = ?`,
    [companyId]
  )
  console.log('  Updated company settings (tax, receipt footer, warehouse)')
}

async function seedExpenses(companyId, branchId) {
  const [[{ count }]] = await db.query(
    'SELECT COUNT(*) AS count FROM expenses WHERE company_id = ?',
    [companyId]
  )
  if (count > 0) {
    console.log('  Expenses already exist — skipping')
    return
  }
  await db.query(
    `INSERT INTO expenses (company_id, branch_id, category, amount, description, expense_date, expense_type, recorded_by)
     VALUES
     (?, NULL, 'rent', 2500, 'Monthly venue rent', CURDATE(), 'fixed', NULL),
     (?, NULL, 'salary', 4200, 'Management salaries', CURDATE(), 'payroll', NULL),
     (?, ?, 'utilities', 380, 'Electricity & water', CURDATE(), 'variable', NULL)`,
    [companyId, companyId, companyId, branchId]
  )
  console.log('  Added sample expenses (rent, salary, utilities)')
}

async function main() {
  console.log(`Seeding sample data for ${email}...`)

  const account = await findAccount()
  const branch = await findPrimaryBranch(account.company_id, account.user_id)

  console.log(`Account: ${account.company_name} (company #${account.company_id})`)
  console.log(`Branch: ${branch.name} (#${branch.id})`)

  await seedCompanySettings(account.company_id)
  await seedExpenses(account.company_id, branch.id)
  const products = await seedProducts(account.company_id, branch.id)
  const employees = await seedEmployees(account.company_id, branch.id)
  const tables = await seedTables(branch.id)
  await seedTabsAndOrders(account.company_id, branch.id, account.user_id, products, tables, employees)

  console.log('\nDone! Log in and explore:')
  console.log('  Admin → Products, Tables, Employees')
  console.log('  POS → Open a shift, sell items, manage tabs')
  console.log('  Kitchen → Food orders from burger/wings/fries')

  await db.end()
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
