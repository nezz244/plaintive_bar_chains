import request from 'supertest'
import app from '../server.js'

const TEST_PASSWORD = 'testpass123'

export function uniqueEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@venuepos.test`
}

export async function registerCompany(overrides = {}) {
  const payload = {
    companyName: overrides.companyName || `Test Co ${Date.now()}`,
    email: overrides.email || uniqueEmail('co'),
    password: overrides.password || TEST_PASSWORD,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    branchName: overrides.branchName || 'Main Branch',
    branchType: overrides.branchType || 'bar',
    ...overrides,
  }

  const res = await request(app).post('/api/auth/register').send(payload)
  return { res, payload }
}

export async function login(email, password = TEST_PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password })
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

export { request, app, TEST_PASSWORD }
