import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'

const router = express.Router()
router.use(authenticate)

function defaultRange(from, to) {
  return {
    from: from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: to || new Date().toISOString().slice(0, 10),
  }
}

// GET /api/reports/pl — profit & loss
router.get('/pl', async (req, res) => {
  const { branchId, from, to } = req.query
  const range = defaultRange(from, to)
  const companyId = req.user.company_id

  try {
    let revenueSql = `
      SELECT COALESCE(SUM(o.total_amount), 0) AS revenue,
             COALESCE(SUM(
               (SELECT SUM(oi.quantity * p.buying_price)
                FROM order_items oi JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id)
             ), 0) AS cogs
      FROM orders o
      WHERE o.company_id = ? AND o.status = 'completed'
        AND DATE(o.completed_at) BETWEEN ? AND ?`
    const revenueParams = [companyId, range.from, range.to]

    if (branchId) {
      revenueSql += ' AND o.branch_id = ?'
      revenueParams.push(branchId)
    }

    const [[revenueRow]] = await db.query(revenueSql, revenueParams)
    const revenue = Number(revenueRow.revenue)
    const cogs = Number(revenueRow.cogs)
    const grossProfit = revenue - cogs

    let expenseSql = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE company_id = ? AND expense_date BETWEEN ? AND ?`
    const expenseParams = [companyId, range.from, range.to]

    if (branchId) {
      expenseSql += ' AND (branch_id = ? OR branch_id IS NULL)'
      expenseParams.push(branchId)
    }

    const [[expenseRow]] = await db.query(expenseSql, expenseParams)
    const expenses = Number(expenseRow.total)
    const netProfit = grossProfit - expenses

    const [byBranch] = await db.query(
      `SELECT b.id, b.name,
              COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount END), 0) AS revenue,
              COALESCE((
                SELECT SUM(e.amount) FROM expenses e
                WHERE e.branch_id = b.id AND e.expense_date BETWEEN ? AND ?
              ), 0) AS branch_expenses
       FROM branches b
       LEFT JOIN orders o ON o.branch_id = b.id
         AND DATE(o.completed_at) BETWEEN ? AND ?
       WHERE b.company_id = ? AND b.is_active = TRUE
       GROUP BY b.id, b.name
       ORDER BY b.name`,
      [range.from, range.to, range.from, range.to, companyId]
    )

    const [expensesByCategory] = await db.query(
      `SELECT category, SUM(amount) AS total
       FROM expenses
       WHERE company_id = ? AND expense_date BETWEEN ? AND ?
       ${branchId ? 'AND (branch_id = ? OR branch_id IS NULL)' : ''}
       GROUP BY category ORDER BY total DESC`,
      branchId
        ? [companyId, range.from, range.to, branchId]
        : [companyId, range.from, range.to]
    )

    res.json({
      range,
      summary: {
        revenue,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        marginPct: revenue ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0,
      },
      byBranch,
      expensesByCategory,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate P&L report' })
  }
})

// GET /api/reports/stock-audit — flagged shifts summary
router.get('/stock-audit', async (req, res) => {
  const { branchId, from, to } = req.query
  const range = defaultRange(from, to)

  try {
    let sql = `
      SELECT s.id, s.branch_id, b.name AS branch_name, s.start_time, s.end_time,
             s.stock_audit_status, s.stock_variance_total, s.stock_audit_notes,
             s.variance AS cash_variance, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
      FROM shifts s
      JOIN branches b ON b.id = s.branch_id
      JOIN employees e ON e.id = s.employee_id
      WHERE b.company_id = ? AND s.status = 'closed'
        AND DATE(s.end_time) BETWEEN ? AND ?`
    const params = [req.user.company_id, range.from, range.to]

    if (branchId) {
      sql += ' AND s.branch_id = ?'
      params.push(branchId)
    }

    sql += ' ORDER BY s.end_time DESC LIMIT 100'

    const [shifts] = await db.query(sql, params)
    res.json({ range, shifts })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock audit report' })
  }
})

export default router
