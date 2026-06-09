import { describe, it, expect } from 'vitest'
import { request, app, registerCompany, authHeader } from './helpers.mjs'

describe('expenses API', () => {
  it('creates and lists company-wide expenses', async () => {
    const { res: reg } = await registerCompany()
    const token = reg.body.token

    const createRes = await request(app)
      .post('/api/expenses')
      .set(authHeader(token))
      .send({
        category: 'rent',
        amount: 1500,
        expenseDate: '2026-01-01',
        expenseType: 'fixed',
        description: 'Monthly rent',
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.expense.category).toBe('rent')

    const listRes = await request(app).get('/api/expenses').set(authHeader(token))
    expect(listRes.status).toBe(200)
    expect(listRes.body.expenses.length).toBeGreaterThan(0)
  })
})

describe('reports API', () => {
  it('returns P&L summary', async () => {
    const { res: reg } = await registerCompany()
    const token = reg.body.token

    const res = await request(app).get('/api/reports/pl').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.summary).toHaveProperty('revenue')
    expect(res.body.summary).toHaveProperty('netProfit')
  })
})
