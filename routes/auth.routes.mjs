import express from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { signToken, authenticate, loadBranchAccess } from '../middleware/auth.mjs'

const router = express.Router()

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function logAudit(companyId, userId, action, entityType, entityId, details, req) {
  await db.query(
    `INSERT INTO audit_log (company_id, user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [companyId, userId, action, entityType, entityId, JSON.stringify(details), req.ip]
  )
}

// POST /api/auth/register — onboard new company
router.post('/register', async (req, res) => {
  const {
    companyName,
    businessType = 'multi',
    email,
    password,
    firstName,
    lastName,
    phone,
    branchName,
    branchType = 'bar',
  } = req.body

  if (!companyName || !email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Company name, email, password, and name are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    let slug = slugify(companyName)
    const [existing] = await conn.query('SELECT id FROM companies WHERE slug = ?', [slug])
    if (existing.length) slug = `${slug}-${Date.now()}`

    const [companyResult] = await conn.query(
      `INSERT INTO companies (name, slug, business_type, email, phone, status)
       VALUES (?, ?, ?, ?, ?, 'trial')`,
      [companyName, slug, businessType, email, phone || null]
    )
    const companyId = companyResult.insertId

    const passwordHash = await bcrypt.hash(password, 12)
    const [userResult] = await conn.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, company_role)
       VALUES (?, ?, ?, ?, ?, ?, 'owner')`,
      [companyId, email, passwordHash, firstName, lastName, phone || null]
    )
    const userId = userResult.insertId

    let branch = null
    if (branchName) {
      const branchSlug = slugify(branchName)
      const [branchResult] = await conn.query(
        `INSERT INTO branches (company_id, name, slug, branch_type)
         VALUES (?, ?, ?, ?)`,
        [companyId, branchName, branchSlug, branchType]
      )
      branch = { id: branchResult.insertId, name: branchName, slug: branchSlug }

      await conn.query(
        `INSERT INTO user_branch_access (user_id, branch_id, role) VALUES (?, ?, 'manager')`,
        [userId, branch.id]
      )
    }

    await conn.commit()

    const token = signToken({ userId, companyId })

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        companyRole: 'owner',
        companyId,
        companyName,
        companySlug: slug,
      },
      branch,
    })
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }
    console.error('Registration error:', err)
    res.status(500).json({ error: 'Registration failed' })
  } finally {
    conn.release()
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const [users] = await db.query(
      `SELECT u.*, c.name AS company_name, c.slug AS company_slug, c.status AS company_status
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.email = ? AND u.is_active = TRUE`,
      [email]
    )

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = users[0]

    if (user.company_status === 'suspended') {
      return res.status(403).json({ error: 'Your company account has been suspended' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

    const [branchAccess] = await db.query(
      `SELECT uba.branch_id, uba.role, b.name AS branch_name, b.slug AS branch_slug, b.branch_type
       FROM user_branch_access uba
       JOIN branches b ON b.id = uba.branch_id
       WHERE uba.user_id = ? AND uba.is_active = TRUE AND b.is_active = TRUE`,
      [user.id]
    )

    const token = signToken({ userId: user.id, companyId: user.company_id })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyRole: user.company_role,
        companyId: user.company_id,
        companyName: user.company_name,
        companySlug: user.company_slug,
        branchAccess,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, loadBranchAccess, async (req, res) => {
  const [branches] = await db.query(
    `SELECT id, name, slug, branch_type, is_active
     FROM branches WHERE company_id = ? ORDER BY name`,
    [req.user.company_id]
  )

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
      companyRole: req.user.company_role,
      companyId: req.user.company_id,
      companyName: req.user.company_name,
      companySlug: req.user.company_slug,
      branchAccess: req.user.branchAccess || [],
    },
    branches,
  })
})

// PUT /api/auth/password
router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Valid current and new passwords are required (min 8 chars)' })
  }

  const [[user]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id])

  res.json({ message: 'Password updated successfully' })
})

export { logAudit }
export default router
