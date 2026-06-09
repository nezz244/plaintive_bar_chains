import { describe, it, expect, beforeAll } from 'vitest'
import db from '../db.js'
import { request, app, registerCompany, login, authHeader, TEST_PASSWORD } from './helpers.mjs'

describe('VenuePOS API', () => {
  beforeAll(async () => {
    await db.query('SELECT 1')
  })

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.service).toBe('VenuePOS API')
    })
  })

  describe('POST /api/auth/register', () => {
    it('creates a company, owner, and branch', async () => {
      const { res, payload } = await registerCompany()
      expect(res.status).toBe(201)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user.email).toBe(payload.email)
      expect(res.body.user.companyRole).toBe('owner')
      expect(res.body.branch).toMatchObject({ name: payload.branchName })
    })

    it('rejects short passwords', async () => {
      const { res } = await registerCompany({ password: 'short' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/8 characters/)
    })

    it('rejects missing required fields', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'x@test.com' })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const { res: reg, payload } = await registerCompany()
      expect(reg.status).toBe(201)

      const res = await login(payload.email, payload.password)
      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user.email).toBe(payload.email)
      expect(res.body.user.branchAccess.length).toBeGreaterThan(0)
    })

    it('rejects invalid credentials', async () => {
      const res = await login('nobody@venuepos.test', TEST_PASSWORD)
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user and branches', async () => {
      const { res: reg } = await registerCompany()
      const token = reg.body.token

      const res = await request(app).get('/api/auth/me').set(authHeader(token))
      expect(res.status).toBe(200)
      expect(res.body.user.companyRole).toBe('owner')
      expect(res.body.branches.length).toBeGreaterThan(0)
    })

    it('requires authentication', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })
  })

  describe('Branches and POS', () => {
    it('lists branches and fetches POS products after seeding catalog', async () => {
      const { res: reg } = await registerCompany()
      const token = reg.body.token
      const branchId = reg.body.branch.id

      const productRes = await request(app)
        .post('/api/pos/products')
        .set(authHeader(token))
        .send({
          name: 'Test Lager',
          sku: 'TEST-LAG',
          category: 'Beer',
          sellingPrice: 4.5,
          branchIds: [branchId],
        })
      expect(productRes.status).toBe(201)

      const branchesRes = await request(app).get('/api/branches').set(authHeader(token))
      expect(branchesRes.status).toBe(200)
      expect(branchesRes.body.branches.some((b) => b.id === branchId)).toBe(true)

      const productsRes = await request(app)
        .get(`/api/pos/${branchId}/products`)
        .set(authHeader(token))
      expect(productsRes.status).toBe(200)
      expect(productsRes.body.products.some((p) => p.name === 'Test Lager')).toBe(true)
    })
  })

  describe('Tables and shifts', () => {
    it('creates a table and opens a shift with an employee', async () => {
      const { res: reg } = await registerCompany()
      const token = reg.body.token
      const branchId = reg.body.branch.id

      const empRes = await request(app)
        .post('/api/users/employees')
        .set(authHeader(token))
        .send({ firstName: 'Shift', lastName: 'Worker', role: 'cashier', branchId, pinCode: '1234' })
      expect(empRes.status).toBe(201)
      const employeeId = empRes.body.employee.id

      const tableRes = await request(app)
        .post(`/api/tables/${branchId}`)
        .set(authHeader(token))
        .send({ tableNumber: 'T99', label: 'Test Table', capacity: 4 })
      expect(tableRes.status).toBe(201)

      const shiftRes = await request(app)
        .post(`/api/shifts/${branchId}/open`)
        .set(authHeader(token))
        .send({ employeeId, openingCash: 100, pinCode: '1234' })
      expect(shiftRes.status).toBe(201)
      expect(shiftRes.body.shift.status).toBe('open')
    })
  })

  describe('Void, refund, and tabs', () => {
    it('voids open tab order and settles tab with cash', async () => {
      const { res: reg } = await registerCompany()
      const token = reg.body.token
      const branchId = reg.body.branch.id

      await request(app).post('/api/users/employees').set(authHeader(token)).send({
        firstName: 'Bar', lastName: 'Tender', role: 'manager', branchId, pinCode: '9999',
      })
      const empRes = await request(app).post('/api/users/employees').set(authHeader(token)).send({
        firstName: 'Bar', lastName: 'Staff', role: 'cashier', branchId, pinCode: '5678',
      })
      const employeeId = empRes.body.employee.id

      await request(app).post(`/api/shifts/${branchId}/open`).set(authHeader(token)).send({
        employeeId, openingCash: 50, pinCode: '5678',
      })

      const productRes = await request(app).post('/api/pos/products').set(authHeader(token)).send({
        name: 'Tab Beer', sellingPrice: 5, branchIds: [branchId],
      })
      const productId = productRes.body.product.id
      await db.query('UPDATE branch_stock SET units_available = 20 WHERE branch_id = ? AND product_id = ?', [branchId, productId])

      const tabRes = await request(app).post(`/api/tables/${branchId}/tabs`).set(authHeader(token)).send({
        tabName: 'Test Tab', customerName: 'Guest',
      })
      const tabId = tabRes.body.tab.id

      const orderRes = await request(app).post(`/api/pos/${branchId}/orders`).set(authHeader(token)).send({
        items: [{ productId, quantity: 2 }],
        tabId,
        paymentMethod: 'tab',
        payLater: true,
      })
      expect(orderRes.status).toBe(201)
      const orderId = orderRes.body.order.id

      const voidRes = await request(app).post(`/api/pos/${branchId}/orders/${orderId}/void`).set(authHeader(token)).send({
        reason: 'Wrong tab',
      })
      expect(voidRes.status).toBe(200)

      await request(app).post(`/api/pos/${branchId}/orders`).set(authHeader(token)).send({
        items: [{ productId, quantity: 1 }],
        tabId,
        paymentMethod: 'tab',
        payLater: true,
      })

      const settleRes = await request(app).post(`/api/tables/${branchId}/tabs/${tabId}/settle`).set(authHeader(token)).send({
        paymentMethod: 'cash',
        amountTendered: 10,
        closeTab: true,
      })
      expect(settleRes.status).toBe(200)
      expect(settleRes.body.total).toBe(5)
    })
  })

  describe('Orders', () => {
    it('completes a cash sale and deducts stock', async () => {
      const { res: reg } = await registerCompany()
      const token = reg.body.token
      const branchId = reg.body.branch.id

      const productRes = await request(app)
        .post('/api/pos/products')
        .set(authHeader(token))
        .send({
          name: 'Sale Item',
          sellingPrice: 5,
          branchIds: [branchId],
        })
      const productId = productRes.body.product.id
      await db.query(
        'UPDATE branch_stock SET units_available = 10 WHERE branch_id = ? AND product_id = ?',
        [branchId, productId]
      )

      const empRes = await request(app)
        .post('/api/users/employees')
        .set(authHeader(token))
        .send({ firstName: 'Cashier', lastName: 'One', role: 'cashier', branchId, pinCode: '4321' })
      const employeeId = empRes.body.employee.id

      await request(app)
        .post(`/api/shifts/${branchId}/open`)
        .set(authHeader(token))
        .send({ employeeId, openingCash: 50, pinCode: '4321' })

      const orderRes = await request(app)
        .post(`/api/pos/${branchId}/orders`)
        .set(authHeader(token))
        .send({
          items: [{ productId, quantity: 2 }],
          employeeId,
          paymentMethod: 'cash',
          amountTendered: 20,
        })

      expect(orderRes.status).toBe(201)
      expect(orderRes.body.order.payment_status).toBe('paid')
      expect(Number(orderRes.body.order.total_amount)).toBe(10)

      const stockRes = await request(app)
        .get(`/api/pos/${branchId}/products`)
        .set(authHeader(token))
      const product = stockRes.body.products.find((p) => p.id === productId)
      expect(product.stock).toBe(8)
    })
  })
})
