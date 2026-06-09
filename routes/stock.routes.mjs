import express from 'express'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'
import {
  recordStockMovement,
  ensureWarehouseStock,
  getWarehouseRow,
} from '../lib/stockHelpers.mjs'

const router = express.Router()
router.use(authenticate)

async function getCompanyWarehouseMode(companyId) {
  const [[company]] = await db.query(
    'SELECT warehouse_mode FROM companies WHERE id = ?',
    [companyId]
  )
  return company?.warehouse_mode || 'central'
}

async function verifyBranch(branchId, companyId) {
  const [[branch]] = await db.query(
    'SELECT id, name FROM branches WHERE id = ? AND company_id = ?',
    [branchId, companyId]
  )
  return branch
}

// GET /api/stock/:branchId — floor + warehouse levels
router.get('/:branchId', async (req, res) => {
  try {
    const branch = await verifyBranch(req.params.branchId, req.user.company_id)
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const warehouseMode = await getCompanyWarehouseMode(req.user.company_id)

    const [products] = await db.query(
      `SELECT p.id, p.name, p.sku, p.category, p.units_per_case,
              COALESCE(bs.units_available, 0) AS floor_stock,
              COALESCE(ws.cases_available, 0) AS warehouse_cases
       FROM products p
       LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
       LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
         AND ws.company_id = p.company_id
         AND ws.branch_id <=> ?
       WHERE p.company_id = ? AND p.is_active = TRUE
       ORDER BY p.category, p.name`,
      [branch.id, warehouseMode === 'per_branch' ? branch.id : null, req.user.company_id]
    )

    res.json({ branch, warehouseMode, products })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock' })
  }
})

// POST /api/stock/:branchId/transfer — release warehouse stock to floor
router.post('/:branchId/transfer', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { productId, quantity, notes } = req.body
  const units = parseInt(quantity, 10)

  if (!productId || !units || units <= 0) {
    return res.status(400).json({ error: 'Product and positive quantity are required' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const branch = await verifyBranch(req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const warehouseMode = await getCompanyWarehouseMode(req.user.company_id)
    const whBranchId = warehouseMode === 'per_branch' ? branch.id : null

    const [[product]] = await conn.query(
      'SELECT id, name, units_per_case FROM products WHERE id = ? AND company_id = ?',
      [productId, req.user.company_id]
    )
    if (!product) {
      await conn.rollback()
      return res.status(404).json({ error: 'Product not found' })
    }

    await ensureWarehouseStock(conn, req.user.company_id, productId, branch.id, warehouseMode)
    const wh = await getWarehouseRow(conn, req.user.company_id, productId, branch.id, warehouseMode)
    const unitsPerCase = product.units_per_case || 1
    const casesNeeded = Math.ceil(units / unitsPerCase)

    if (wh.cases_available < casesNeeded) {
      await conn.rollback()
      return res.status(400).json({ error: 'Insufficient warehouse stock' })
    }

    await conn.query(
      `UPDATE warehouse_stock SET cases_available = cases_available - ?
       WHERE id = ?`,
      [casesNeeded, wh.id]
    )

    await conn.query(
      `INSERT INTO branch_stock (branch_id, product_id, units_available)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = units_available + VALUES(units_available)`,
      [branch.id, productId, units]
    )

    await recordStockMovement(conn, {
      companyId: req.user.company_id,
      branchId: branch.id,
      productId,
      movementType: 'transfer_in',
      quantity: units,
      referenceType: 'transfer',
      userId: req.user.id,
      notes: notes || `Released ${units} units from warehouse`,
    })

    await recordStockMovement(conn, {
      companyId: req.user.company_id,
      branchId: branch.id,
      productId,
      movementType: 'transfer_out',
      quantity: -units,
      referenceType: 'warehouse',
      userId: req.user.id,
      notes: `Warehouse release (${casesNeeded} cases)`,
    })

    await conn.commit()
    await logAudit(req.user.company_id, req.user.id, 'stock.transfer', 'product', productId, { branchId: branch.id, units }, req)

    res.json({ message: `Transferred ${units} units to floor stock` })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Transfer failed' })
  } finally {
    conn.release()
  }
})

// POST /api/stock/:branchId/adjust — wastage or manual adjustment
router.post('/:branchId/adjust', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { productId, quantity, movementType = 'wastage', notes } = req.body
  const delta = parseInt(quantity, 10)

  if (!productId || !delta || delta === 0) {
    return res.status(400).json({ error: 'Product and non-zero quantity are required' })
  }
  if (!['wastage', 'adjustment'].includes(movementType)) {
    return res.status(400).json({ error: 'Invalid movement type' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const branch = await verifyBranch(req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const [[stock]] = await conn.query(
      'SELECT units_available FROM branch_stock WHERE branch_id = ? AND product_id = ? FOR UPDATE',
      [branch.id, productId]
    )
    if (!stock) {
      await conn.rollback()
      return res.status(404).json({ error: 'No floor stock record for this product' })
    }

    const newQty = stock.units_available + delta
    if (newQty < 0) {
      await conn.rollback()
      return res.status(400).json({ error: 'Adjustment would result in negative stock' })
    }

    await conn.query(
      'UPDATE branch_stock SET units_available = ? WHERE branch_id = ? AND product_id = ?',
      [newQty, branch.id, productId]
    )

    await recordStockMovement(conn, {
      companyId: req.user.company_id,
      branchId: branch.id,
      productId,
      movementType,
      quantity: delta,
      userId: req.user.id,
      notes,
    })

    await conn.commit()
    res.json({ message: 'Stock updated', unitsAvailable: newQty })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Adjustment failed' })
  } finally {
    conn.release()
  }
})

// GET /api/stock/:branchId/reconciliation
router.get('/:branchId/reconciliation', async (req, res) => {
  const { from, to } = req.query
  const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const dateTo = to || new Date().toISOString().slice(0, 10)

  try {
    const branch = await verifyBranch(req.params.branchId, req.user.company_id)
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [shiftAudits] = await db.query(
      `SELECT s.id AS shift_id, s.start_time, s.end_time, s.stock_audit_status,
              s.stock_variance_total, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
              ssc.product_id, p.name AS product_name, ssc.opening_qty, ssc.sold_qty,
              ssc.expected_qty, ssc.counted_qty, ssc.variance
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
       LEFT JOIN shift_stock_counts ssc ON ssc.shift_id = s.id
       LEFT JOIN products p ON p.id = ssc.product_id
       WHERE s.branch_id = ? AND s.status = 'closed'
         AND DATE(s.end_time) BETWEEN ? AND ?
       ORDER BY s.end_time DESC, p.name`,
      [branch.id, dateFrom, dateTo]
    )

    const [salesVsStock] = await db.query(
      `SELECT p.id AS product_id, p.name AS product_name,
              COALESCE(SUM(oi.quantity), 0) AS units_sold,
              COALESCE(bs.units_available, 0) AS current_floor_stock
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
         AND o.branch_id = ? AND o.status = 'completed'
         AND DATE(o.completed_at) BETWEEN ? AND ?
       LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
       WHERE p.company_id = ? AND p.is_active = TRUE
       GROUP BY p.id, p.name, bs.units_available
       HAVING units_sold > 0
       ORDER BY units_sold DESC`,
      [branch.id, dateFrom, dateTo, branch.id, req.user.company_id]
    )

    res.json({ branch, from: dateFrom, to: dateTo, shiftAudits, salesVsStock })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch reconciliation' })
  }
})

export default router
