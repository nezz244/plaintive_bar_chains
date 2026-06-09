import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signToken, verifyToken } from '../middleware/auth.mjs'

describe('auth middleware tokens', () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests'
  })

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret
  })

  it('signs and verifies a token payload', () => {
    const token = signToken({ userId: 42, companyId: 7 })
    const decoded = verifyToken(token)
    expect(decoded.userId).toBe(42)
    expect(decoded.companyId).toBe(7)
  })

  it('rejects tampered tokens', () => {
    const token = signToken({ userId: 1, companyId: 1 })
    expect(() => verifyToken(`${token}x`)).toThrow()
  })
})
