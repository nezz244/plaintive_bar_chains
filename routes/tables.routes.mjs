import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'

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
