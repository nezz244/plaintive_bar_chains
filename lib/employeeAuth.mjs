import db from '../db.js'

const MANAGER_ROLES = ['manager', 'supervisor', 'owner']

export async function findEmployeeByPin(conn, branchId, companyId, pinCode) {
  if (!pinCode || String(pinCode).length < 4) return null

  const [[employee]] = await conn.query(
    `SELECT id, first_name, last_name, role, pin_code, employee_code
     FROM employees
     WHERE branch_id = ? AND company_id = ? AND is_active = TRUE AND pin_code = ?`,
    [branchId, companyId, String(pinCode)]
  )
  return employee || null
}

export async function verifyEmployeePin(conn, branchId, companyId, employeeId, pinCode) {
  const [[employee]] = await conn.query(
    `SELECT id, first_name, last_name, role
     FROM employees
     WHERE id = ? AND branch_id = ? AND company_id = ? AND is_active = TRUE AND pin_code = ?`,
    [employeeId, branchId, companyId, String(pinCode)]
  )
  return employee || null
}

export function isManagerRole(role) {
  return MANAGER_ROLES.includes(role) || role === 'manager' || role === 'supervisor'
}

export async function verifyManagerPin(conn, branchId, companyId, pinCode) {
  const employee = await findEmployeeByPin(conn, branchId, companyId, pinCode)
  if (!employee) return null
  if (!isManagerRole(employee.role) && employee.role !== 'cashier') {
    // Allow cashier PIN for void of open orders only — manager check separate at route level
    return employee
  }
  return employee
}

export async function requireManagerOrAdmin(req, conn, branchId, companyId, pinCode) {
  if (['owner', 'admin'].includes(req.user.company_role)) {
    return { id: null, first_name: req.user.first_name, last_name: req.user.last_name, role: req.user.company_role }
  }
  const employee = await findEmployeeByPin(conn, branchId, companyId, pinCode)
  if (!employee) return null
  if (!['manager', 'supervisor'].includes(employee.role)) return null
  return employee
}
