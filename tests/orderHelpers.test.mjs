import { describe, it, expect } from 'vitest'
import { generateOrderNumber } from '../lib/orderHelpers.mjs'

describe('generateOrderNumber', () => {
  it('returns a string starting with ORD-', () => {
    const num = generateOrderNumber()
    expect(num).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/)
  })

  it('generates unique order numbers', () => {
    const a = generateOrderNumber()
    const b = generateOrderNumber()
    expect(a).not.toBe(b)
  })
})
