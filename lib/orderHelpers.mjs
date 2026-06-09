export function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${ts}-${rand}`
}

export async function getBranch(conn, branchId, companyId) {
  const [[branch]] = await conn.query(
    'SELECT id, company_id, name FROM branches WHERE id = ? AND company_id = ?',
    [branchId, companyId]
  )
  return branch || null
}

export async function getActiveShift(conn, branchId, userId) {
  const [[shift]] = await conn.query(
    `SELECT id FROM shifts WHERE branch_id = ? AND user_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1`,
    [branchId, userId]
  )
  return shift || null
}

export async function fetchOrderReceipt(db, orderId, companyId) {
  const [[order]] = await db.query(
    `SELECT o.*, b.name AS branch_name, b.address AS branch_address,
            c.name AS company_name, c.currency, c.receipt_footer, c.tax_rate,
            vt.table_number, vt.label AS table_label,
            t.tab_name, t.customer_name AS tab_customer,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name
     FROM orders o
     JOIN branches b ON b.id = o.branch_id
     JOIN companies c ON c.id = o.company_id
     LEFT JOIN venue_tables vt ON vt.id = o.table_id
     LEFT JOIN tabs t ON t.id = o.tab_id
     LEFT JOIN employees e ON e.id = o.employee_id
     WHERE o.id = ? AND o.company_id = ?`,
    [orderId, companyId]
  )
  if (!order) return null

  const [items] = await db.query(
    `SELECT oi.quantity, oi.unit_price, oi.total_price, oi.notes, p.name AS product_name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id`,
    [orderId]
  )

  const [payments] = await db.query(
    'SELECT method, amount, status, reference FROM payments WHERE order_id = ?',
    [orderId]
  )

  return { order, items, payments }
}

export async function updateShiftSales(conn, shiftId, paymentMethod, amount) {
  const col =
    paymentMethod === 'cash' ? 'cash_sales'
    : paymentMethod === 'card' || paymentMethod === 'yoco' ? 'card_sales'
    : 'mobile_sales'

  await conn.query(
    `UPDATE shifts SET ${col} = ${col} + ?, total_sales = total_sales + ? WHERE id = ?`,
    [amount, amount, shiftId]
  )
}

export async function reverseShiftSales(conn, shiftId, paymentMethod, amount) {
  const col =
    paymentMethod === 'cash' ? 'cash_sales'
    : paymentMethod === 'card' || paymentMethod === 'yoco' ? 'card_sales'
    : 'mobile_sales'

  await conn.query(
    `UPDATE shifts SET ${col} = GREATEST(0, ${col} - ?), total_sales = GREATEST(0, total_sales - ?) WHERE id = ?`,
    [amount, amount, shiftId]
  )
}

export async function getFullShift(conn, branchId, userId) {
  const [[shift]] = await conn.query(
    `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
     FROM shifts s JOIN employees e ON e.id = s.employee_id
     WHERE s.branch_id = ? AND s.user_id = ? AND s.status = 'open'
     ORDER BY s.start_time DESC LIMIT 1`,
    [branchId, userId]
  )
  return shift || null
}
