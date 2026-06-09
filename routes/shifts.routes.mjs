import express from 'express'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'
import {
  snapshotShiftOpening,
  refreshShiftSoldQty,
  getShiftStockAudit,
  evaluateStockAudit,
  recordStockMovement,
} from '../lib/stockHelpers.mjs'

const router = express.Router()
router.use(authenticate)

// GET /api/shifts/:branchId/current
router.get('/:branchId/current', async (req, res) => {
  try {
    const [[shift]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
       JOIN branches b ON b.id = s.branch_id
       WHERE s.branch_id = ? AND s.user_id = ? AND s.status = 'open' AND b.company_id = ?
       ORDER BY s.start_time DESC LIMIT 1`,
      [req.params.branchId, req.user.id, req.user.company_id]
    )
    res.json({ shift: shift || null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch shift' })
  }
})

// GET /api/shifts/:branchId — shift history
router.get('/:branchId', async (req, res) => {
  try {
    const [shifts] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s
       JOIN employees e ON e.id = s.employee_id
       JOIN branches b ON b.id = s.branch_id
       WHERE s.branch_id = ? AND b.company_id = ?
       ORDER BY s.start_time DESC LIMIT 50`,
      [req.params.branchId, req.user.company_id]
    )
    res.json({ shifts })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch shifts' })
  }
})

// GET /api/shifts/:branchId/:shiftId/stock-audit
router.get('/:branchId/:shiftId/stock-audit', async (req, res) => {
  try {
    const [[shift]] = await db.query(
      `SELECT s.id FROM shifts s
       JOIN branches b ON b.id = s.branch_id
       WHERE s.id = ? AND s.branch_id = ? AND b.company_id = ?`,
      [req.params.shiftId, req.params.branchId, req.user.company_id]
    )
    if (!shift) return res.status(404).json({ error: 'Shift not found' })

    await refreshShiftSoldQty(db, shift.id)
    const lines = await getShiftStockAudit(db, shift.id)
    res.json({ lines })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock audit' })
  }
})

// POST /api/shifts/:branchId/open
router.post('/:branchId/open', async (req, res) => {
  const { employeeId, openingCash = 0, pinCode } = req.body

  if (!employeeId) return res.status(400).json({ error: 'Employee is required to open a shift' })
  if (!pinCode) return res.status(400).json({ error: 'Employee PIN is required' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [[branch]] = await conn.query(
      'SELECT id, company_id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const { verifyEmployeePin } = await import('../lib/employeeAuth.mjs')
    const employee = await verifyEmployeePin(conn, branch.id, branch.company_id, employeeId, pinCode)
    if (!employee) {
      await conn.rollback()
      return res.status(401).json({ error: 'Invalid employee PIN' })
    }

    const [[existing]] = await conn.query(
      "SELECT id FROM shifts WHERE branch_id = ? AND user_id = ? AND status = 'open'",
      [req.params.branchId, req.user.id]
    )
    if (existing) {
      await conn.rollback()
      return res.status(409).json({ error: 'You already have an open shift' })
    }

    const [result] = await conn.query(
      `INSERT INTO shifts (branch_id, employee_id, user_id, opening_cash, status, stock_audit_status)
       VALUES (?, ?, ?, ?, 'open', 'pending')`,
      [req.params.branchId, employeeId, req.user.id, openingCash]
    )

    await snapshotShiftOpening(conn, result.insertId, branch.id, branch.company_id)
    await conn.commit()

    const [[shift]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE s.id = ?`,
      [result.insertId]
    )
    res.status(201).json({ shift })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Failed to open shift' })
  } finally {
    conn.release()
  }
})

// POST /api/shifts/:branchId/switch-employee
router.post('/:branchId/switch-employee', async (req, res) => {
  const { employeeId, pinCode } = req.body
  if (!employeeId || !pinCode) {
    return res.status(400).json({ error: 'Employee and PIN are required' })
  }

  try {
    const { verifyEmployeePin } = await import('../lib/employeeAuth.mjs')
    const employee = await verifyEmployeePin(db, req.params.branchId, req.user.company_id, employeeId, pinCode)
    if (!employee) return res.status(401).json({ error: 'Invalid employee PIN' })

    const [result] = await db.query(
      `UPDATE shifts s
       JOIN branches b ON b.id = s.branch_id
       SET s.employee_id = ?
       WHERE s.branch_id = ? AND s.user_id = ? AND s.status = 'open' AND b.company_id = ?`,
      [employeeId, req.params.branchId, req.user.id, req.user.company_id]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'No open shift found' })

    const [[shift]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id
       WHERE s.branch_id = ? AND s.user_id = ? AND s.status = 'open'`,
      [req.params.branchId, req.user.id]
    )
    res.json({ shift })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to switch employee' })
  }
})

// POST /api/shifts/:branchId/:shiftId/close
router.post('/:branchId/:shiftId/close', async (req, res) => {
  const { closingCash, notes, stockCounts = [], stockAuditNotes } = req.body

  if (closingCash == null) return res.status(400).json({ error: 'Closing cash count is required' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [[shift]] = await conn.query(
      `SELECT s.*, b.company_id FROM shifts s
       JOIN branches b ON b.id = s.branch_id
       WHERE s.id = ? AND s.branch_id = ? AND s.user_id = ? AND s.status = 'open' AND b.company_id = ?`,
      [req.params.shiftId, req.params.branchId, req.user.id, req.user.company_id]
    )
    if (!shift) {
      await conn.rollback()
      return res.status(404).json({ error: 'Open shift not found' })
    }

    await refreshShiftSoldQty(conn, shift.id)
    const auditLines = await getShiftStockAudit(conn, shift.id)

    if (auditLines.length && stockCounts.length !== auditLines.length) {
      await conn.rollback()
      return res.status(400).json({
        error: 'Stock count required for all audited products',
        requiredCount: auditLines.length,
      })
    }

    const countMap = Object.fromEntries(stockCounts.map((c) => [c.productId, c.countedQty]))
    const merged = auditLines.map((line) => ({
      ...line,
      counted_qty: countMap[line.product_id] ?? line.counted_qty,
    }))

    const [[company]] = await conn.query(
      'SELECT stock_variance_threshold FROM companies WHERE id = ?',
      [shift.company_id]
    )
    const threshold = Number(company?.stock_variance_threshold || 5)
    const { totalVariance, flagged, lines } = evaluateStockAudit(merged, threshold)

    for (const line of lines) {
      if (line.counted_qty == null) continue
      await conn.query(
        `UPDATE shift_stock_counts SET counted_qty = ?, variance = ? WHERE shift_id = ? AND product_id = ?`,
        [line.counted_qty, line.variance, shift.id, line.product_id]
      )
      await recordStockMovement(conn, {
        companyId: shift.company_id,
        branchId: shift.branch_id,
        productId: line.product_id,
        movementType: 'shift_count',
        quantity: line.variance,
        referenceType: 'shift',
        referenceId: shift.id,
        shiftId: shift.id,
        userId: req.user.id,
        notes: `Expected ${line.expected_qty}, counted ${line.counted_qty}`,
      })
      if (line.variance !== 0) {
        await conn.query(
          `UPDATE branch_stock SET units_available = GREATEST(0, units_available + ?)
           WHERE branch_id = ? AND product_id = ?`,
          [line.variance, shift.branch_id, line.product_id]
        )
      }
    }

    const expectedCash = Number(shift.opening_cash) + Number(shift.cash_sales)
    const variance = Number(closingCash) - expectedCash
    const stockStatus = auditLines.length ? (flagged ? 'flagged' : 'submitted') : 'approved'

    await conn.query(
      `UPDATE shifts SET
         closing_cash = ?, expected_cash = ?, variance = ?,
         end_time = NOW(), status = 'closed', notes = ?,
         stock_audit_status = ?, stock_variance_total = ?, stock_audit_notes = ?
       WHERE id = ?`,
      [
        closingCash,
        expectedCash,
        variance,
        notes || null,
        stockStatus,
        totalVariance,
        stockAuditNotes || null,
        shift.id,
      ]
    )

    await conn.commit()

    if (flagged) {
      await logAudit(shift.company_id, req.user.id, 'shift.stock_flagged', 'shift', shift.id, { totalVariance }, req)
    }

    const [[closed]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE s.id = ?`,
      [shift.id]
    )
    res.json({ shift: closed, stockAudit: { lines, flagged, totalVariance } })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Failed to close shift' })
  } finally {
    conn.release()
  }
})

// POST /api/shifts/:branchId/:shiftId/approve-stock
router.post('/:branchId/:shiftId/approve-stock', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { notes } = req.body
  try {
    const [result] = await db.query(
      `UPDATE shifts s
       JOIN branches b ON b.id = s.branch_id
       SET s.stock_audit_status = 'approved', s.stock_audit_notes = CONCAT(COALESCE(s.stock_audit_notes, ''), ?)
       WHERE s.id = ? AND s.branch_id = ? AND b.company_id = ? AND s.stock_audit_status = 'flagged'`,
      [notes ? `\nApproved: ${notes}` : '', req.params.shiftId, req.params.branchId, req.user.company_id]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'Flagged shift not found' })
    await logAudit(req.user.company_id, req.user.id, 'shift.stock_approved', 'shift', Number(req.params.shiftId), {}, req)
    res.json({ message: 'Stock audit approved' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to approve stock audit' })
  }
})

export default router
