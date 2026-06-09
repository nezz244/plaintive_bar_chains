import express from 'express'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()

router.use(authenticate)

// GET /api/companies/current
router.get('/current', async (req, res) => {
  try {
    const [[company]] = await db.query(
      `SELECT id, name, slug, business_type, email, phone, address, country,
              currency, timezone, logo_url, tax_rate, receipt_footer,
              warehouse_mode, stock_variance_threshold,
              yoco_public_key, status, subscription_plan, trial_ends_at, created_at
       FROM companies WHERE id = ?`,
      [req.user.company_id]
    )

    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM branches WHERE company_id = ? AND is_active = TRUE) AS branch_count,
         (SELECT COUNT(*) FROM users WHERE company_id = ? AND is_active = TRUE) AS user_count,
         (SELECT COUNT(*) FROM employees WHERE company_id = ? AND is_active = TRUE) AS employee_count,
         (SELECT COUNT(*) FROM products WHERE company_id = ? AND is_active = TRUE) AS product_count`,
      [req.user.company_id, req.user.company_id, req.user.company_id, req.user.company_id]
    )

    res.json({ company, stats })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch company' })
  }
})

// PUT /api/companies/current
router.put('/current', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const {
    name, businessType, phone, address, country, currency, timezone,
    taxRate, receiptFooter, warehouseMode, stockVarianceThreshold,
  } = req.body

  try {
    await db.query(
      `UPDATE companies SET
         name = COALESCE(?, name),
         business_type = COALESCE(?, business_type),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         country = COALESCE(?, country),
         currency = COALESCE(?, currency),
         timezone = COALESCE(?, timezone),
         tax_rate = COALESCE(?, tax_rate),
         receipt_footer = COALESCE(?, receipt_footer),
         warehouse_mode = COALESCE(?, warehouse_mode),
         stock_variance_threshold = COALESCE(?, stock_variance_threshold)
       WHERE id = ?`,
      [
        name, businessType, phone, address, country, currency, timezone,
        taxRate, receiptFooter, warehouseMode, stockVarianceThreshold,
        req.user.company_id,
      ]
    )

    await logAudit(req.user.company_id, req.user.id, 'company.updated', 'company', req.user.company_id, req.body, req)

    const [[company]] = await db.query('SELECT * FROM companies WHERE id = ?', [req.user.company_id])
    res.json({ company })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update company' })
  }
})

// GET /api/companies/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const companyId = req.user.company_id

    const [branches] = await db.query(
      `SELECT b.id, b.name, b.slug, b.branch_type, b.is_active,
              COALESCE(SUM(o.total_amount), 0) AS today_revenue,
              COUNT(DISTINCT o.id) AS today_orders
       FROM branches b
       LEFT JOIN orders o ON o.branch_id = b.id
         AND DATE(o.created_at) = CURDATE()
         AND o.status = 'completed'
       WHERE b.company_id = ?
       GROUP BY b.id
       ORDER BY b.name`,
      [companyId]
    )

    const [[totals]] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'completed' THEN total_amount END), 0) AS today_revenue,
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY AND status = 'completed' THEN total_amount END), 0) AS yesterday_revenue,
         COUNT(CASE WHEN DATE(created_at) = CURDATE() AND status = 'completed' THEN 1 END) AS today_orders,
         (SELECT COUNT(*) FROM employees WHERE company_id = ? AND is_active = TRUE) AS active_employees,
         (SELECT COUNT(*) FROM branches WHERE company_id = ? AND is_active = TRUE) AS active_branches
       FROM orders WHERE company_id = ?`,
      [companyId, companyId, companyId]
    )

    const yesterday = Number(totals.yesterday_revenue) || 0
    const today = Number(totals.today_revenue) || 0
    const growth = yesterday === 0 ? 0 : ((today - yesterday) / yesterday) * 100

    res.json({
      branches,
      totals: {
        todayRevenue: today,
        yesterdayRevenue: yesterday,
        growth: parseFloat(growth.toFixed(2)),
        todayOrders: totals.today_orders,
        activeEmployees: totals.active_employees,
        activeBranches: totals.active_branches,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch dashboard' })
  }
})

export default router
