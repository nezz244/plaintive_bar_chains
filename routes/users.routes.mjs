import express from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()

const BRANCH_ROLES = ['manager', 'supervisor', 'cashier', 'bartender', 'server', 'kitchen', 'host']

router.use(authenticate)

// GET /api/users
router.get('/', requireCompanyRole('owner', 'admin'), async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.company_role,
              u.is_active, u.last_login, u.created_at,
              GROUP_CONCAT(
                CONCAT(b.name, ':', uba.role) SEPARATOR '|'
              ) AS branch_roles
       FROM users u
       LEFT JOIN user_branch_access uba ON uba.user_id = u.id AND uba.is_active = TRUE
       LEFT JOIN branches b ON b.id = uba.branch_id
       WHERE u.company_id = ?
       GROUP BY u.id
       ORDER BY u.first_name, u.last_name`,
      [req.user.company_id]
    )
    res.json({ users })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// POST /api/users — create employee with system access
router.post('/', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    companyRole = 'member',
    branchAccess = [],
    createEmployee = true,
    employeeRole = 'staff',
    pinCode,
  } = req.body

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, first name, and last name are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const passwordHash = await bcrypt.hash(password, 12)
    const [userResult] = await conn.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, company_role, pin_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, email, passwordHash, firstName, lastName, phone || null, companyRole, pinCode || null]
    )
    const userId = userResult.insertId

    for (const access of branchAccess) {
      if (!BRANCH_ROLES.includes(access.role)) continue
      const [[branch]] = await conn.query(
        'SELECT id FROM branches WHERE id = ? AND company_id = ?',
        [access.branchId, req.user.company_id]
      )
      if (branch) {
        await conn.query(
          'INSERT INTO user_branch_access (user_id, branch_id, role) VALUES (?, ?, ?)',
          [userId, access.branchId, access.role]
        )
      }
    }

    if (createEmployee) {
      const primaryBranch = branchAccess[0]?.branchId || null
      await conn.query(
        `INSERT INTO employees (company_id, branch_id, user_id, first_name, last_name, role, phone, pin_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.company_id, primaryBranch, userId, firstName, lastName, employeeRole, phone || null, pinCode || null]
      )
    }

    await conn.commit()
    await logAudit(req.user.company_id, req.user.id, 'user.created', 'user', userId, { email }, req)

    const [[user]] = await db.query(
      'SELECT id, email, first_name, last_name, company_role, is_active FROM users WHERE id = ?',
      [userId]
    )
    res.status(201).json({ user })
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists' })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create user' })
  } finally {
    conn.release()
  }
})

// PUT /api/users/:userId/access — update branch access
router.put('/:userId/access', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { branchAccess } = req.body
  const userId = parseInt(req.params.userId, 10)

  try {
    const [[user]] = await db.query(
      'SELECT id, company_role FROM users WHERE id = ? AND company_id = ?',
      [userId, req.user.company_id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.company_role === 'owner') {
      return res.status(403).json({ error: 'Cannot modify owner access' })
    }

    await db.query('DELETE FROM user_branch_access WHERE user_id = ?', [userId])

    for (const access of branchAccess || []) {
      if (!BRANCH_ROLES.includes(access.role)) continue
      const [[branch]] = await db.query(
        'SELECT id FROM branches WHERE id = ? AND company_id = ?',
        [access.branchId, req.user.company_id]
      )
      if (branch) {
        await db.query(
          'INSERT INTO user_branch_access (user_id, branch_id, role, is_active) VALUES (?, ?, ?, ?)',
          [userId, access.branchId, access.role, access.isActive !== false]
        )
      }
    }

    const [access] = await db.query(
      `SELECT uba.*, b.name AS branch_name FROM user_branch_access uba
       JOIN branches b ON b.id = uba.branch_id WHERE uba.user_id = ?`,
      [userId]
    )
    res.json({ access })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update access' })
  }
})

// PUT /api/users/:userId/status
router.put('/:userId/status', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { isActive } = req.body
  const userId = parseInt(req.params.userId, 10)

  try {
    const [[user]] = await db.query(
      'SELECT id, company_role FROM users WHERE id = ? AND company_id = ?',
      [userId, req.user.company_id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.company_role === 'owner') {
      return res.status(403).json({ error: 'Cannot deactivate owner account' })
    }

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userId])
    res.json({ message: isActive ? 'User activated' : 'User deactivated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update user status' })
  }
})

// ─── Employees (staff without login) ─────────────────────────────────────────

// GET /api/users/employees
router.get('/employees/list', async (req, res) => {
  const { branchId } = req.query
  try {
    let query = `
      SELECT e.*, b.name AS branch_name, u.email AS user_email
      FROM employees e
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.company_id = ?`
    const params = [req.user.company_id]

    if (branchId) {
      query += ' AND e.branch_id = ?'
      params.push(branchId)
    }
    query += ' ORDER BY e.first_name, e.last_name'

    const [employees] = await db.query(query, params)
    res.json({ employees })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch employees' })
  }
})

// POST /api/users/employees
router.post('/employees', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { firstName, lastName, branchId, role = 'staff', phone, pinCode, hireDate } = req.body

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First and last name are required' })
  }

  try {
    if (branchId) {
      const [[branch]] = await db.query(
        'SELECT id FROM branches WHERE id = ? AND company_id = ?',
        [branchId, req.user.company_id]
      )
      if (!branch) return res.status(404).json({ error: 'Branch not found' })
    }

    const [count] = await db.query(
      'SELECT COUNT(*) AS cnt FROM employees WHERE company_id = ?',
      [req.user.company_id]
    )
    const employeeCode = `EMP${String(count[0].cnt + 1).padStart(4, '0')}`

    const [result] = await db.query(
      `INSERT INTO employees (company_id, branch_id, employee_code, first_name, last_name, role, phone, pin_code, hire_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, branchId || null, employeeCode, firstName, lastName, role, phone || null, pinCode || null, hireDate || null]
    )

    const [[employee]] = await db.query('SELECT * FROM employees WHERE id = ?', [result.insertId])
    res.status(201).json({ employee })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create employee' })
  }
})

// PUT /api/users/employees/:employeeId
router.put('/employees/:employeeId', requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { firstName, lastName, branchId, role, phone, pinCode, isActive } = req.body

  try {
    const [[existing]] = await db.query(
      'SELECT id FROM employees WHERE id = ? AND company_id = ?',
      [req.params.employeeId, req.user.company_id]
    )
    if (!existing) return res.status(404).json({ error: 'Employee not found' })

    await db.query(
      `UPDATE employees SET
         first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         branch_id = COALESCE(?, branch_id),
         role = COALESCE(?, role),
         phone = COALESCE(?, phone),
         pin_code = COALESCE(?, pin_code),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [firstName, lastName, branchId, role, phone, pinCode, isActive, req.params.employeeId]
    )

    const [[employee]] = await db.query('SELECT * FROM employees WHERE id = ?', [req.params.employeeId])
    res.json({ employee })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update employee' })
  }
})

export default router
