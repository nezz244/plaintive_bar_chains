import express from 'express'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()
router.use(authenticate)

const EXPENSE_CATEGORIES = ['rent', 'salary', 'utilities', 'supplies', 'maintenance', 'marketing', 'insurance', 'other']

// GET /api/expenses
router.get('/', async (req, res) => {
  const { branchId, from, to, category } = req.query

  try {
    let sql = `
      SELECT e.*, b.name AS branch_name
      FROM expenses e
      LEFT JOIN branches b ON b.id = e.branch_id
      WHERE e.company_id = ?`
    const params = [req.user.company_id]

    if (branchId === 'company') {
      sql += ' AND e.branch_id IS NULL'
    } else if (branchId) {
      sql += ' AND e.branch_id = ?'
      params.push(branchId)
    }

    if (from) {
      sql += ' AND e.expense_date >= ?'
      params.push(from)
    }
    if (to) {
      sql += ' AND e.expense_date <= ?'
      params.push(to)
    }
    if (category) {
      sql += ' AND e.category = ?'
      params.push(category)
    }

    sql += ' ORDER BY e.expense_date DESC, e.id DESC LIMIT 500'

    const [expenses] = await db.query(sql, params)
    res.json({ expenses, categories: EXPENSE_CATEGORIES })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

// POST /api/expenses
router.post('/', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { branchId, category, amount, description, expenseDate, expenseType = 'variable' } = req.body

  if (!category || amount == null || !expenseDate) {
    return res.status(400).json({ error: 'Category, amount, and date are required' })
  }

  try {
    if (branchId) {
      const [[branch]] = await db.query(
        'SELECT id FROM branches WHERE id = ? AND company_id = ?',
        [branchId, req.user.company_id]
      )
      if (!branch) return res.status(404).json({ error: 'Branch not found' })
    }

    const [result] = await db.query(
      `INSERT INTO expenses (company_id, branch_id, category, amount, description, expense_date, expense_type, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        branchId || null,
        category,
        amount,
        description || null,
        expenseDate,
        expenseType,
        req.user.id,
      ]
    )

    await logAudit(req.user.company_id, req.user.id, 'expense.created', 'expense', result.insertId, req.body, req)

    const [[expense]] = await db.query(
      `SELECT e.*, b.name AS branch_name FROM expenses e
       LEFT JOIN branches b ON b.id = e.branch_id WHERE e.id = ?`,
      [result.insertId]
    )
    res.status(201).json({ expense })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create expense' })
  }
})

// DELETE /api/expenses/:expenseId
router.delete('/:expenseId', requireCompanyRole('owner', 'admin'), async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM expenses WHERE id = ? AND company_id = ?',
      [req.params.expenseId, req.user.company_id]
    )
    if (!result.affectedRows) return res.status(404).json({ error: 'Expense not found' })
    await logAudit(req.user.company_id, req.user.id, 'expense.deleted', 'expense', Number(req.params.expenseId), {}, req)
    res.json({ message: 'Expense deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete expense' })
  }
})

export default router
