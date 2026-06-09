import jwt from 'jsonwebtoken'
import db from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'venuepos-dev-secret-change-in-production'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const token = header.slice(7)
    const decoded = verifyToken(token)

    const [users] = await db.query(
      `SELECT u.id, u.company_id, u.email, u.first_name, u.last_name,
              u.company_role, u.is_active, c.name AS company_name, c.slug AS company_slug
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.userId]
    )

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = users[0]
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireCompanyRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!roles.includes(req.user.company_role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

export async function loadBranchAccess(req, res, next) {
  if (!req.user) return next()

  const [access] = await db.query(
    `SELECT uba.branch_id, uba.role, b.name AS branch_name, b.slug AS branch_slug
     FROM user_branch_access uba
     JOIN branches b ON b.id = uba.branch_id
     WHERE uba.user_id = ? AND uba.is_active = TRUE AND b.is_active = TRUE`,
    [req.user.id]
  )

  req.user.branchAccess = access
  next()
}

export async function requireBranchAccess(branchIdParam = 'branchId') {
  return async (req, res, next) => {
    const branchId = parseInt(req.params[branchIdParam], 10)
    if (!branchId) {
      return res.status(400).json({ error: 'Invalid branch ID' })
    }

    if (['owner', 'admin'].includes(req.user.company_role)) {
      const [branches] = await db.query(
        'SELECT id FROM branches WHERE id = ? AND company_id = ?',
        [branchId, req.user.company_id]
      )
      if (!branches.length) {
        return res.status(404).json({ error: 'Branch not found' })
      }
      req.branchId = branchId
      return next()
    }

    const access = req.user.branchAccess?.find((a) => a.branch_id === branchId)
    if (!access) {
      return res.status(403).json({ error: 'No access to this branch' })
    }

    req.branchId = branchId
    req.branchRole = access.role
    next()
  }
}
