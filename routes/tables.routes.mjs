import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'
import { getBranch, getActiveShift, fetchOrderReceipt, updateShiftSales } from '../lib/orderHelpers.mjs'
import { completeOrderOnTab } from '../lib/orderOperations.mjs'
import { verifyAndCharge } from '../lib/yoco.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()
router.use(authenticate)

async function verifyBranch(branchId, companyId) {
  const [[branch]] = await db.query(
    'SELECT id FROM branches WHERE id = ? AND company_id = ?',
    [branchId, companyId]
  )
  return branch
}

// GET /api/tables/:branchId
router.get('/:branchId', async (req, res) => {
  try {
    if (!(await verifyBranch(req.params.branchId, req.user.company_id))) {
      return res.status(404).json({ error: 'Branch not found' })
    }

    const [tables] = await db.query(
      `SELECT vt.*,
              (SELECT COUNT(*) FROM orders o WHERE o.table_id = vt.id AND o.status = 'open') AS open_orders
       FROM venue_tables vt
       WHERE vt.branch_id = ? AND vt.is_active = TRUE
       ORDER BY vt.zone, vt.table_number`,
      [req.params.branchId]
    )
    res.json({ tables })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tables' })
  }
})

// POST /api/tables/:branchId
router.post('/:branchId', async (req, res) => {
  const { tableNumber, label, capacity, zone, posX, posY } = req.body
  if (!tableNumber) return res.status(400).json({ error: 'Table number is required' })

  try {
    if (!(await verifyBranch(req.params.branchId, req.user.company_id))) {
      return res.status(404).json({ error: 'Branch not found' })
    }

    const [result] = await db.query(
      `INSERT INTO venue_tables (branch_id, table_number, label, capacity, zone, pos_x, pos_y)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.branchId, tableNumber, label || null, capacity || 4, zone || 'main', posX || 0, posY || 0]
    )

    const [[table]] = await db.query('SELECT * FROM venue_tables WHERE id = ?', [result.insertId])
    res.status(201).json({ table })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Table number already exists' })
    console.error(err)
    res.status(500).json({ error: 'Failed to create table' })
  }
})

// PUT /api/tables/:branchId/:tableId
router.put('/:branchId/:tableId', async (req, res) => {
  const { label, capacity, zone, status, posX, posY, isActive } = req.body
  try {
    const [[table]] = await db.query(
      `SELECT vt.id FROM venue_tables vt
       JOIN branches b ON b.id = vt.branch_id
       WHERE vt.id = ? AND vt.branch_id = ? AND b.company_id = ?`,
      [req.params.tableId, req.params.branchId, req.user.company_id]
    )
    if (!table) return res.status(404).json({ error: 'Table not found' })

    await db.query(
      `UPDATE venue_tables SET
         label = COALESCE(?, label),
         capacity = COALESCE(?, capacity),
         zone = COALESCE(?, zone),
         status = COALESCE(?, status),
         pos_x = COALESCE(?, pos_x),
         pos_y = COALESCE(?, pos_y),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [label, capacity, zone, status, posX, posY, isActive, req.params.tableId]
    )

    const [[updated]] = await db.query('SELECT * FROM venue_tables WHERE id = ?', [req.params.tableId])
    res.json({ table: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update table' })
  }
})

// ─── Tabs ──────────────────────────────────────────────────────────────────────

// GET /api/tables/:branchId/tabs
router.get('/:branchId/tabs', async (req, res) => {
  try {
    const [tabs] = await db.query(
      `SELECT t.*, vt.table_number, vt.label AS table_label,
              (SELECT COUNT(*) FROM orders o WHERE o.tab_id = t.id AND o.status = 'open') AS open_orders
       FROM tabs t
       LEFT JOIN venue_tables vt ON vt.id = t.table_id
       JOIN branches b ON b.id = t.branch_id
       WHERE t.branch_id = ? AND b.company_id = ?
       ORDER BY t.status ASC, t.opened_at DESC`,
      [req.params.branchId, req.user.company_id]
    )
    res.json({ tabs })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tabs' })
  }
})

// POST /api/tables/:branchId/tabs
router.post('/:branchId/tabs', async (req, res) => {
  const { tabName, customerName, tableId, employeeId } = req.body
  if (!tabName) return res.status(400).json({ error: 'Tab name is required' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const branch = await verifyBranch(req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const [result] = await conn.query(
      `INSERT INTO tabs (branch_id, tab_name, customer_name, table_id, employee_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.branchId, tabName, customerName || null, tableId || null, employeeId || null, req.user.id]
    )

    if (tableId) {
      await conn.query("UPDATE venue_tables SET status = 'occupied' WHERE id = ?", [tableId])
    }

    await conn.commit()
    const [[tab]] = await db.query('SELECT * FROM tabs WHERE id = ?', [result.insertId])
    res.status(201).json({ tab })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Failed to open tab' })
  } finally {
    conn.release()
  }
})

// GET /api/tables/:branchId/tabs/:tabId
router.get('/:branchId/tabs/:tabId', async (req, res) => {
  try {
    const [[tab]] = await db.query(
      `SELECT t.*, vt.table_number, vt.label AS table_label
       FROM tabs t
       LEFT JOIN venue_tables vt ON vt.id = t.table_id
       JOIN branches b ON b.id = t.branch_id
       WHERE t.id = ? AND t.branch_id = ? AND b.company_id = ?`,
      [req.params.tabId, req.params.branchId, req.user.company_id]
    )
    if (!tab) return res.status(404).json({ error: 'Tab not found' })

    const [orders] = await db.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.subtotal, o.tax_amount,
              o.total_amount, o.created_at, o.notes,
              CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM orders o
       LEFT JOIN employees e ON e.id = o.employee_id
       WHERE o.tab_id = ? AND o.status != 'voided'
       ORDER BY o.created_at ASC`,
      [tab.id]
    )

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.quantity, oi.unit_price, oi.total_price, p.name AS product_name
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [order.id]
      )
      order.items = items
    }

    const openTotal = orders
      .filter((o) => o.status === 'open')
      .reduce((s, o) => s + Number(o.total_amount), 0)

    res.json({ tab, orders, openTotal })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch tab' })
  }
})

// POST /api/tables/:branchId/tabs/:tabId/settle
router.post('/:branchId/tabs/:tabId/settle', async (req, res) => {
  const {
    paymentMethod = 'cash',
    yocoToken,
    amountTendered,
    mobileReference,
    closeTab = true,
  } = req.body

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const branch = await getBranch(conn, req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const shift = await getActiveShift(conn, branch.id, req.user.id)
    if (!shift) {
      await conn.rollback()
      return res.status(403).json({ error: 'Open a shift before settling tabs' })
    }

    const [[tab]] = await conn.query(
      `SELECT t.* FROM tabs t
       JOIN branches b ON b.id = t.branch_id
       WHERE t.id = ? AND t.branch_id = ? AND b.company_id = ? AND t.status = 'open'`,
      [req.params.tabId, branch.id, req.user.company_id]
    )
    if (!tab) {
      await conn.rollback()
      return res.status(404).json({ error: 'Open tab not found' })
    }

    const [openOrders] = await conn.query(
      "SELECT * FROM orders WHERE tab_id = ? AND status = 'open' ORDER BY id",
      [tab.id]
    )
    if (!openOrders.length) {
      await conn.rollback()
      return res.status(400).json({ error: 'No open orders on this tab' })
    }

    const [[company]] = await conn.query(
      'SELECT currency, tax_rate FROM companies WHERE id = ?',
      [req.user.company_id]
    )

    let grandTotal = 0
    for (const order of openOrders) {
      grandTotal += Number(order.total_amount)
    }

    if (paymentMethod === 'yoco' && yocoToken) {
      const amountInCents = Math.round(grandTotal * 100)
      await verifyAndCharge(
        req.user.company_id,
        yocoToken,
        amountInCents,
        company.currency || 'ZAR',
        { tabId: tab.id, branchId: branch.id }
      )
    }

    const [[fullShift]] = await conn.query('SELECT id, employee_id FROM shifts WHERE id = ?', [shift.id])

    for (const order of openOrders) {
      await completeOrderOnTab(conn, order, branch, fullShift, req.user.id)
      await conn.query(
        `UPDATE orders SET payment_method = ?, payment_status = 'paid', employee_id = COALESCE(employee_id, ?) WHERE id = ?`,
        [paymentMethod, fullShift?.employee_id, order.id]
      )
      const ref = paymentMethod === 'mobile' && mobileReference
        ? mobileReference
        : amountTendered ? `Tendered: ${amountTendered}` : `Tab settlement`
      await conn.query(
        `INSERT INTO payments (order_id, amount, method, status, reference, yoco_token)
         VALUES (?, ?, ?, 'completed', ?, ?)`,
        [order.id, order.total_amount, paymentMethod, ref, yocoToken || null]
      )
    }

    await updateShiftSales(conn, shift.id, paymentMethod, grandTotal)

    if (closeTab) {
      await conn.query(
        "UPDATE tabs SET status = 'closed', closed_at = NOW() WHERE id = ?",
        [tab.id]
      )
      if (tab.table_id) {
        await conn.query("UPDATE venue_tables SET status = 'dirty' WHERE id = ?", [tab.table_id])
      }
    }

    await logAudit(req.user.company_id, req.user.id, 'tab.settled', 'tab', tab.id, {
      paymentMethod,
      total: grandTotal,
      orderCount: openOrders.length,
    }, req)

    await conn.commit()

    const lastOrderId = openOrders[openOrders.length - 1].id
    const receipt = await fetchOrderReceipt(db, lastOrderId, req.user.company_id)

    res.json({
      message: 'Tab settled',
      total: grandTotal,
      orderCount: openOrders.length,
      tabClosed: closeTab,
      receipt,
    })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(400).json({ error: err.message || 'Tab settlement failed' })
  } finally {
    conn.release()
  }
})

// POST /api/tables/:branchId/tabs/:tabId/close
router.post('/:branchId/tabs/:tabId/close', async (req, res) => {
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [[tab]] = await conn.query(
      `SELECT t.* FROM tabs t
       JOIN branches b ON b.id = t.branch_id
       WHERE t.id = ? AND t.branch_id = ? AND b.company_id = ? AND t.status = 'open'`,
      [req.params.tabId, req.params.branchId, req.user.company_id]
    )
    if (!tab) {
      await conn.rollback()
      return res.status(404).json({ error: 'Open tab not found' })
    }

    await conn.query(
      "UPDATE tabs SET status = 'closed', closed_at = NOW() WHERE id = ?",
      [tab.id]
    )

    if (tab.table_id) {
      await conn.query("UPDATE venue_tables SET status = 'dirty' WHERE id = ?", [tab.table_id])
    }

    await conn.commit()
    res.json({ message: 'Tab closed' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Failed to close tab' })
  } finally {
    conn.release()
  }
})

export default router
