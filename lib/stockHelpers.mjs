import db from '../db.js'

export async function recordStockMovement(conn, {
  companyId,
  branchId,
  productId,
  movementType,
  quantity,
  referenceType = null,
  referenceId = null,
  shiftId = null,
  userId = null,
  notes = null,
}) {
  await conn.query(
    `INSERT INTO stock_movements
       (company_id, branch_id, product_id, movement_type, quantity, reference_type, reference_id, shift_id, user_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [companyId, branchId, productId, movementType, quantity, referenceType, referenceId, shiftId, userId, notes]
  )
}

export async function getWarehouseRow(conn, companyId, productId, branchId, warehouseMode) {
  const whBranchId = warehouseMode === 'per_branch' ? branchId : null
  const [[row]] = await conn.query(
    `SELECT id, cases_available FROM warehouse_stock
     WHERE company_id = ? AND product_id = ? AND branch_id <=> ?`,
    [companyId, productId, whBranchId]
  )
  return row || null
}

export async function ensureWarehouseStock(conn, companyId, productId, branchId, warehouseMode) {
  const whBranchId = warehouseMode === 'per_branch' ? branchId : null
  const existing = await getWarehouseRow(conn, companyId, productId, branchId, warehouseMode)
  if (existing) return existing

  await conn.query(
    `INSERT INTO warehouse_stock (company_id, branch_id, product_id, cases_available)
     VALUES (?, ?, ?, 0)`,
    [companyId, whBranchId, productId]
  )
  return getWarehouseRow(conn, companyId, productId, branchId, warehouseMode)
}

export async function snapshotShiftOpening(conn, shiftId, branchId, companyId) {
  const [products] = await conn.query(
    `SELECT p.id AS product_id, COALESCE(bs.units_available, 0) AS opening_qty
     FROM products p
     LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
     WHERE p.company_id = ? AND p.is_active = TRUE AND p.audit_on_shift_close = TRUE`,
    [branchId, companyId]
  )

  for (const p of products) {
    await conn.query(
      `INSERT INTO shift_stock_counts (shift_id, product_id, opening_qty, sold_qty, expected_qty)
       VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE opening_qty = VALUES(opening_qty), expected_qty = VALUES(opening_qty)`,
      [shiftId, p.product_id, p.opening_qty, p.opening_qty]
    )
    if (p.opening_qty > 0) {
      await recordStockMovement(conn, {
        companyId,
        branchId,
        productId: p.product_id,
        movementType: 'opening',
        quantity: p.opening_qty,
        referenceType: 'shift',
        referenceId: shiftId,
        shiftId,
        notes: 'Shift opening snapshot',
      })
    }
  }
}

export async function refreshShiftSoldQty(conn, shiftId) {
  await conn.query(
    `UPDATE shift_stock_counts ssc
     JOIN (
       SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) AS sold
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.shift_id = ? AND o.status = 'completed'
       GROUP BY oi.product_id
     ) sales ON sales.product_id = ssc.product_id
     SET ssc.sold_qty = sales.sold,
         ssc.expected_qty = GREATEST(0, ssc.opening_qty - sales.sold)
     WHERE ssc.shift_id = ?`,
    [shiftId, shiftId]
  )

  await conn.query(
    `UPDATE shift_stock_counts
     SET expected_qty = GREATEST(0, opening_qty - sold_qty)
     WHERE shift_id = ?`,
    [shiftId]
  )
}

export async function getShiftStockAudit(dbOrConn, shiftId) {
  const [rows] = await dbOrConn.query(
    `SELECT ssc.*, p.name AS product_name, p.sku, p.category
     FROM shift_stock_counts ssc
     JOIN products p ON p.id = ssc.product_id
     WHERE ssc.shift_id = ?
     ORDER BY p.category, p.name`,
    [shiftId]
  )
  return rows
}

export function evaluateStockAudit(counts, thresholdPercent = 5) {
  let totalVariance = 0
  let flagged = false
  const lines = counts.map((row) => {
    const expected = Number(row.expected_qty)
    const counted = Number(row.counted_qty)
    const variance = counted - expected
    totalVariance += Math.abs(variance)
    const base = Math.max(expected, row.opening_qty, 1)
    const pct = (Math.abs(variance) / base) * 100
    if (pct > thresholdPercent) flagged = true
    return { ...row, variance, variancePct: parseFloat(pct.toFixed(2)) }
  })
  return { lines, totalVariance, flagged }
}
