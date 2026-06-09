import express from 'express'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

router.use(authenticate)

// GET /api/branches
router.get('/', async (req, res) => {
  try {
    const [branches] = await db.query(
      `SELECT b.*,
              (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.is_active = TRUE) AS employee_count,
              (SELECT COUNT(*) FROM user_branch_access uba WHERE uba.branch_id = b.id AND uba.is_active = TRUE) AS user_count
       FROM branches b
       WHERE b.company_id = ?
       ORDER BY b.name`,
      [req.user.company_id]
    )
    res.json({ branches })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch branches' })
  }
})

// GET /api/branches/:branchId
router.get('/:branchId', async (req, res) => {
  try {
    const [[branch]] = await db.query(
      'SELECT * FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [employees] = await db.query(
      `SELECT id, first_name, last_name, role, employee_code, is_active
       FROM employees WHERE branch_id = ? ORDER BY first_name`,
      [branch.id]
    )

    const [access] = await db.query(
      `SELECT uba.id, uba.role, uba.is_active, u.id AS user_id, u.email,
              u.first_name, u.last_name, u.company_role
       FROM user_branch_access uba
       JOIN users u ON u.id = uba.user_id
       WHERE uba.branch_id = ?`,
      [branch.id]
    )

    res.json({ branch, employees, access })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch branch' })
  }
})

// POST /api/branches
router.post('/', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { name, branchType = 'bar', address, phone, email, openingTime, closingTime } = req.body

  if (!name) return res.status(400).json({ error: 'Branch name is required' })

  try {
    let slug = slugify(name)
    const [existing] = await db.query(
      'SELECT id FROM branches WHERE company_id = ? AND slug = ?',
      [req.user.company_id, slug]
    )
    if (existing.length) slug = `${slug}-${Date.now()}`

    const [result] = await db.query(
      `INSERT INTO branches (company_id, name, slug, branch_type, address, phone, email, opening_time, closing_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.company_id,
        name,
        slug,
        branchType,
        address || null,
        phone || null,
        email || null,
        openingTime || '08:00:00',
        closingTime || '02:00:00',
      ]
    )

    await logAudit(req.user.company_id, req.user.id, 'branch.created', 'branch', result.insertId, { name }, req)

    const [[branch]] = await db.query('SELECT * FROM branches WHERE id = ?', [result.insertId])
    res.status(201).json({ branch })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create branch' })
  }
})

// PUT /api/branches/:branchId
router.put('/:branchId', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { name, branchType, address, phone, email, openingTime, closingTime, isActive } = req.body

  try {
    const [[existing]] = await db.query(
      'SELECT id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!existing) return res.status(404).json({ error: 'Branch not found' })

    await db.query(
      `UPDATE branches SET
         name = COALESCE(?, name),
         branch_type = COALESCE(?, branch_type),
         address = COALESCE(?, address),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         opening_time = COALESCE(?, opening_time),
         closing_time = COALESCE(?, closing_time),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, branchType, address, phone, email, openingTime, closingTime, isActive, req.params.branchId]
    )

    const [[branch]] = await db.query('SELECT * FROM branches WHERE id = ?', [req.params.branchId])
    res.json({ branch })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update branch' })
  }
})

// DELETE /api/branches/:branchId (soft delete)
router.delete('/:branchId', requireCompanyRole('owner'), async (req, res) => {
  try {
    const [[existing]] = await db.query(
      'SELECT id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!existing) return res.status(404).json({ error: 'Branch not found' })

    await db.query('UPDATE branches SET is_active = FALSE WHERE id = ?', [req.params.branchId])
    res.json({ message: 'Branch deactivated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to deactivate branch' })
  }
})

export default router
