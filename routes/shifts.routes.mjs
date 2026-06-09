import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'

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

// POST /api/shifts/:branchId/open
router.post('/:branchId/open', async (req, res) => {
  const { employeeId, openingCash = 0 } = req.body

  if (!employeeId) return res.status(400).json({ error: 'Employee is required to open a shift' })

  try {
    const [[branch]] = await db.query(
      'SELECT id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [[existing]] = await db.query(
      "SELECT id FROM shifts WHERE branch_id = ? AND user_id = ? AND status = 'open'",
      [req.params.branchId, req.user.id]
    )
    if (existing) return res.status(409).json({ error: 'You already have an open shift' })

    const [result] = await db.query(
      `INSERT INTO shifts (branch_id, employee_id, user_id, opening_cash, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [req.params.branchId, employeeId, req.user.id, openingCash]
    )

    const [[shift]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE s.id = ?`,
      [result.insertId]
    )
    res.status(201).json({ shift })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to open shift' })
  }
})

// POST /api/shifts/:branchId/:shiftId/close
router.post('/:branchId/:shiftId/close', async (req, res) => {
  const { closingCash, notes } = req.body

  if (closingCash == null) return res.status(400).json({ error: 'Closing cash count is required' })

  try {
    const [[shift]] = await db.query(
      `SELECT s.* FROM shifts s
       JOIN branches b ON b.id = s.branch_id
       WHERE s.id = ? AND s.branch_id = ? AND s.user_id = ? AND s.status = 'open' AND b.company_id = ?`,
      [req.params.shiftId, req.params.branchId, req.user.id, req.user.company_id]
    )
    if (!shift) return res.status(404).json({ error: 'Open shift not found' })

    const expectedCash = Number(shift.opening_cash) + Number(shift.cash_sales)
    const variance = Number(closingCash) - expectedCash

    await db.query(
      `UPDATE shifts SET
         closing_cash = ?, expected_cash = ?, variance = ?,
         end_time = NOW(), status = 'closed', notes = ?
       WHERE id = ?`,
      [closingCash, expectedCash, variance, notes || null, shift.id]
    )

    const [[closed]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id WHERE s.id = ?`,
      [shift.id]
    )
    res.json({ shift: closed })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to close shift' })
  }
})

export default router
